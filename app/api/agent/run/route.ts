import { NextResponse } from 'next/server'
import { getServiceSupabase, supabase as clientSupabase } from '@/lib/supabase'
import { callAI, userHasOwnKey } from '@/lib/ai-client'
import { deductCost, refundCost, ensureWallet, awardCoins } from '@/lib/wallet'

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await clientSupabase.auth.getUser(token)
    if (!user || authError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { projectId, featureId, provider, model, prompt: directPrompt } = await req.json()

    // Ensure wallet exists
    await ensureWallet(user.id)
    
    // Skip economy if user has their own key (BYOK)
    const isBYOK = await userHasOwnKey(user.id, provider)
    
    if (!isBYOK) {
      const costResult = await deductCost(user.id, model)
      if (!costResult.success) {
        return NextResponse.json(
          { error: costResult.message },
          { status: 402 }
        )
      }
    }
    
    if (!projectId || !provider || !model) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    const supabase = getServiceSupabase()

    // a. Load Feature
    let feature = null
    if (featureId) {
      const { data: f, error: fError } = await supabase
        .from('features')
        .select('*')
        .eq('id', featureId)
        .single()
      if (!fError) feature = f
    }

    // b. Load Structured Prompt
    let promptData = null
    if (featureId) {
      const { data: p } = await supabase
        .from('prompts')
        .select('structured_prompt')
        .eq('feature_id', featureId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      promptData = p
    }

    const basePrompt = directPrompt || promptData?.structured_prompt || feature?.description || 'Implement this feature.'

    // c. Load Context Files
    const contextPaths = [
      'reminisce/context/architecture.md',
      'reminisce/context/coding-guidelines.md',
      'reminisce/context/ai-governance.md',
      'reminisce/context/tech-stack.md'
    ]
    const { data: contexts } = await supabase
      .from('contexts')
      .select('file_path, content')
      .eq('project_id', projectId)
      .in('file_path', contextPaths)

    const contextText = contexts?.map(c => `File: ${c.file_path}\nContent:\n${c.content}`).join('\n\n---\n\n') || ''

    const finalPrompt = `
${basePrompt}

---PROJECT CONTEXT---
${contextText}
`.trim()

    // e. Insert run record
    const { data: run, error: runErr } = await supabase
      .from('agent_runs')
      .insert({
        project_id: projectId,
        feature_id: featureId,
        model_used: `${provider}/${model}`,
        status: 'running',
        prompt_used: finalPrompt,
        started_at: new Date().toISOString()
      })
      .select()
      .single()

    if (runErr) throw runErr

    // f. Call AI with Stream
    const aiRes = await callAI({
      userId: user.id,
      provider,
      model,
      stream: true,
      messages: [
        {
          role: 'system',
          content: 'You are an expert software developer. Implement the requested feature completely and correctly. Include full file paths, complete code, and brief explanations. Format code in markdown code blocks.'
        },
        {
          role: 'user',
          content: finalPrompt
        }
      ]
    })

    // g. Stream response
    const decoder = new TextDecoder()
    
    const stream = new ReadableStream({
      async start(controller) {
        let fullOutput = ''
        const reader = aiRes.body?.getReader()
        if (!reader) {
          controller.close()
          return
        }

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            
            const chunk = decoder.decode(value, { stream: true })
            controller.enqueue(value)

            // OpenRouter/Mistral SSE format cleaning or simple extraction
            const sseLines = chunk.split('\n')
            for (const line of sseLines) {
              if (line.startsWith('data: ')) {
                const dataStr = line.slice(6)
                if (dataStr === '[DONE]') continue
                try {
                  const parsed = JSON.parse(dataStr)
                  fullOutput += parsed.choices?.[0]?.delta?.content || ''
                } catch {}
              }
            }
          }

          // h. Update Supabase on Completion
          await supabase
            .from('agent_runs')
            .update({
              status: 'complete',
              output: fullOutput,
              completed_at: new Date().toISOString(),
              tokens_used: Math.floor(fullOutput.length / 4)
            })
            .eq('id', run.id)

          // Award first-run coins
          try {
            await awardCoins(
              user.id,
              'first_agent_run', 
              projectId
            )
          } catch { /* non-fatal */ }

        } catch (error) {
          console.error('Stream error:', error)
          await supabase
            .from('agent_runs')
            .update({ 
               status: 'failed', 
               output: fullOutput,
               error_message: error instanceof Error ? error.message : String(error)
            })
            .eq('id', run.id)

          // Refund on failure
          if (!isBYOK) {
            await refundCost(user.id, model, run?.id)
          }
        } finally {
          controller.close()
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('Agent run error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
