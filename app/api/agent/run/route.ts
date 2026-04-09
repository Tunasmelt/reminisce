import { NextResponse } from 'next/server'
import { getServiceSupabase, supabase as clientSupabase, verifyProjectAccess } from '@/lib/supabase'
import { callAI, userHasOwnKey } from '@/lib/ai-client'
import { deductCost, refundCost, ensureWallet, awardCoins } from '@/lib/wallet'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await clientSupabase.auth.getUser(token)
    if (!user || authError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })


    // Check if user is banned
    const { isUserBanned } = await import('@/lib/supabase')
    if (await isUserBanned(user.id))
      return NextResponse.json({ error: 'Account suspended' }, { status: 403 })

    const { projectId, featureId, provider, model, prompt: directPrompt } = await req.json()

    
    if (!projectId || !provider || !model) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    if (!await verifyProjectAccess(user.id, projectId))
      return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Ensure wallet exists
    await ensureWallet(user.id)
    
    // Skip economy if user has their own key (BYOK)
    const isBYOK = await userHasOwnKey(user.id, provider)
    
    if (!isBYOK) {
      try {
        const costResult = await deductCost(user.id, model)
        if (!costResult.success) {
          return NextResponse.json(
            { error: costResult.message },
            { status: 402 }
          )
        }
      } catch (err) {
        console.error('[wallet] failed to deduct coins:', err)
        return NextResponse.json({ error: 'Failed to process payment' }, { status: 500 })
      }
    }
    
    
    const supabase = getServiceSupabase()

    // a. Load Feature + Project git state in parallel
    const [featureResult, projectResult] = await Promise.all([
      featureId
        ? supabase.from('features').select('*').eq('id', featureId).single()
        : Promise.resolve({ data: null, error: null }),
      supabase
        .from('projects')
        .select('git_branch, git_last_commit')
        .eq('id', projectId)
        .single(),
    ])
    const feature = featureResult.data ?? null
    const gitBranch = (projectResult.data as { git_branch?: string | null } | null)
      ?.git_branch ?? null

    // b. Load Structured Prompt — also get prompt.id for run_count tracking
    let promptData: { id: string; structured_prompt: string } | null = null
    if (featureId) {
      const { data: p } = await supabase
        .from('prompts')
        .select('id, structured_prompt')
        .eq('feature_id', featureId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      promptData = p ?? null
    }

    const basePrompt = directPrompt || promptData?.structured_prompt || feature?.description || 'Implement this feature.'

    // c. Load Context Files — architecture + coding guidelines always loaded
    // tech-stack also loaded to give agent full stack awareness
    const contextPaths = [
      'reminisce/context/architecture.md',
      'reminisce/context/tech-stack.md',
      'reminisce/context/coding-guidelines.md',
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

    // ── Load product scope for drift detection ────────────────────────────
    const { data: scopeCtx } = await supabase
      .from('contexts')
      .select('content, summary')
      .eq('project_id', projectId)
      .eq('file_path', 'reminisce/context/product-scope.md')
      .maybeSingle()

    const productScope = scopeCtx?.content
      ? scopeCtx.content.slice(0, 1200)
      : scopeCtx?.summary || null

    let systemPrompt = 'You are an expert software developer. Implement the requested feature completely and correctly. Include full file paths, complete code, and brief explanations. Format code in markdown code blocks.'

    if (productScope) {
      systemPrompt += `\n\nSCOPE AWARENESS:
The project is bound by the following scope:
---
${productScope}
---
If the request or your planned implementation drifts outside this scope, you MUST begin your response with "⚠️ Scope alert:" followed by a concise 1-sentence warning about why it drifts.`
    }

    let aiRes: Response
    try {
      // f. Call AI with Stream
      aiRes = await callAI({
        userId: user.id,
        provider,
        model,
        stream: true,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: finalPrompt
          }
        ]
      })
    } catch (aiErr) {
      // Refund if AI call itself fails before stream starts
      if (!isBYOK) {
        await refundCost(user.id, model, run?.id)
      }
      throw aiErr
    }

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
                  const content = parsed.choices?.[0]?.delta?.content || ''
                  fullOutput += content
                } catch {}
              }
            }
          }

          const hasDrift = fullOutput.includes('⚠️ Scope alert:')
          controller.enqueue(
            new TextEncoder().encode(
              `data: ${JSON.stringify({ __agent_meta: true, scopeDrift: hasDrift })}\n\n`
            )
          )
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'))

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

          // ── Increment prompt run_count (non-fatal) ──────────────────────
          if (promptData?.id) {
            try {
              const { error: rpcError } = await supabase.rpc('increment_prompt_run_count', {
                prompt_id: promptData.id,
              })
              if (rpcError) {
                // RPC may not exist yet or failed — fall back to manual increment
                const { data: currentPrompt } = await supabase
                  .from('prompts')
                  .select('run_count')
                  .eq('id', promptData!.id)
                  .single()
                await supabase.from('prompts').update({
                  run_count:    ((currentPrompt?.run_count ?? 0) + 1),
                  last_used_at: new Date().toISOString(),
                }).eq('id', promptData!.id)
              }
            } catch { /* non-fatal */ }
          }

          // ── Append to agent-runs.md changelog (non-fatal) ──────────────
          try {
            const now        = new Date()
            const dateStr    = now.toISOString().slice(0, 16).replace('T', ' ')
            const featureName = feature?.name ?? 'Unknown feature'
            const modelLabel  = `${provider}/${model}`
            const promptSlug  = (basePrompt as string).slice(0, 100).replace(/\n/g, ' ')

            const entry = `\n## ${dateStr} — ${featureName}${gitBranch ? ` (${gitBranch})` : ''}\n**Model:** ${modelLabel}\n**Prompt:** ${promptSlug}...\n**Status:** complete\n---\n`

            const { data: existing } = await supabase
              .from('contexts')
              .select('content')
              .eq('project_id', projectId)
              .eq('file_path', 'reminisce/logs/agent-runs.md')
              .single()

            const currentContent = existing?.content ??
              '# Agent Runs Log\n\nAutomatically appended by Reminisce after each agent run.\n\n'

            await supabase.from('contexts').upsert(
              {
                project_id:    projectId,
                file_path:     'reminisce/logs/agent-runs.md',
                content:       currentContent + entry,
                owned_by:      'developer',
                last_modified: now.toISOString(),
              },
              { onConflict: 'project_id,file_path' },
            )
          } catch { /* non-fatal */ }

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
