import { NextResponse } from 'next/server'
import { getServiceSupabase, supabase as clientSupabase } from '@/lib/supabase'
import { callAI } from '@/lib/ai-client'

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await clientSupabase.auth.getUser(token)
    if (!user || authError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { projectId, featureId, provider, model } = await req.json()
    
    if (!projectId || !featureId || !provider || !model) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    const supabase = getServiceSupabase()

    // a. Load Feature
    const { data: feature, error: fError } = await supabase
      .from('features')
      .select('*')
      .eq('id', featureId)
      .single()
    if (fError) throw fError

    // b. Load Structured Prompt
    const { data: promptData } = await supabase
      .from('prompts')
      .select('structured_prompt')
      .eq('feature_id', featureId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const basePrompt = promptData?.structured_prompt || feature.description || 'Implement this feature.'

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
            
            // For OpenRouter/Mistral, we might need to parse Server-Sent Events
            // but for simplicity here we'll relay the raw chunks if they are text
            // or perform minimal cleaning if it's JSON-wrapped.
            // Actually, callAI returns the raw fetch Response.
            
            controller.enqueue(value)

            // For saving to DB later, let's try to extract text from chunks
            // This varies by provider.
            if (provider === 'gemini') {
              try {
                const lines = chunk.split('\n')
                for (const line of lines) {
                  if (line.trim().startsWith('[') || line.trim().startsWith(',')) {
                    const cleanLine = line.trim().replace(/^,/, '')
                    const parsed = JSON.parse(cleanLine)
                    const text = parsed[0]?.candidates?.[0]?.content?.parts?.[0]?.text || ''
                    fullOutput += text
                  }
                }
              } catch { /* ignore parse errors for partial chunks */ }
            } else {
              // OpenRouter/Mistral SSE format
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

        } catch (error) {
          console.error('Stream error:', error)
          await supabase
            .from('agent_runs')
            .update({ 
               status: 'failed', 
               output: fullOutput, // save whatever we got
               error_message: error instanceof Error ? error.message : String(error)
            })
            .eq('id', run.id)
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
