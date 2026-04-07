import { NextResponse } from 'next/server'
import { getServiceSupabase, supabase as clientSupabase, verifyProjectAccess } from '@/lib/supabase'
import { callAI } from '@/lib/ai-client'
import { deductCost, refundCost } from '@/lib/wallet'
import type { AIProvider } from '@/lib/ai-client'
import {
  getSystemPrompt,
  detectStageSignal,
  extractIdeaData,
  extractFeaturesData,
  extractStackOptions,
  stripSignals,
  classifyError,
  type WizardStageKey,
  type WizardContext,
  type TechStackOption,
  type ConfirmedFeature,
} from '@/lib/wizard-stages'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: Request) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get('authorization')
  if (!authHeader)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } =
    await clientSupabase.auth.getUser(token)
  if (!user || authError)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: {
    sessionId?: string | null
    projectId: string
    message: string
    provider: AIProvider
    model: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const {
    sessionId,
    projectId,
    message,
    provider = 'groq',
    model = 'llama-3.1-8b-instant',
  } = body

  if (!message?.trim() || !projectId)
    return NextResponse.json(
      { error: 'message and projectId are required' },
      { status: 400 },
    )

  if (!await verifyProjectAccess(user.id, projectId))
    return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const supabase = getServiceSupabase()

  try {
    // ── 1. Load or create session ──────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let session: any = null

    if (sessionId) {
      const { data } = await supabase
        .from('wizard_sessions')
        .select('*')
        .eq('id', sessionId)
        .eq('project_id', projectId)
        .single()
      session = data
    }

    if (!session) {
      const { data, error } = await supabase
        .from('wizard_sessions')
        .insert({
          project_id:        projectId,
          status:            'active',
          stage:             'idea',
          stage_data:        {},
          completed_stages:  [],
          confirmed_features:[],
          selected_stack:    {},
          stack_options:     [],
          generation_status: 'idle',
          generation_step:   0,
          messages:          [],
        })
        .select()
        .single()
      if (error) throw error
      session = data
    }

    // ── 2. Guard: no chat during/after generation ──────────────────────────
    if (session.stage === 'generating' || session.stage === 'complete') {
      return NextResponse.json(
        { error: 'Session is in generation or complete state.' },
        { status: 409 },
      )
    }

    // ── 3. Load project name ───────────────────────────────────────────────
    const { data: projectData } = await supabase
      .from('projects')
      .select('name')
      .eq('id', projectId)
      .single()
    const projectName = projectData?.name ?? 'Untitled Project'

    const currentStage = (session.stage ?? 'idea') as WizardStageKey

    // ── 4. Build wizard context ────────────────────────────────────────────
    // Detect if user has mentioned a tech stack in any prior message
    const allUserText = (session.messages ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((m: any) => m.role === 'user')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((m: any) => m.content as string)
      .join(' ')

    const wizardContext: WizardContext = {
      projectName,
      confirmedIdea:    session.confirmed_idea ?? null,
      // NOTE: confirmed_features are read from session but NOT written here.
      // They are only written by PATCH /api/wizard/session when user confirms.
      confirmedFeatures: session.confirmed_features ?? [],
      selectedStack:    session.selected_stack?.id
        ? (session.selected_stack as TechStackOption)
        : null,
      userMentionedStack: detectMentionedStack(allUserText),
    }

    const systemPrompt = getSystemPrompt(currentStage, wizardContext)

    // ── 5. Build messages for AI ───────────────────────────────────────────
    const existingMessages: { role: string; content: string }[] =
      (session.messages ?? []).filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (m: any) => m.role !== 'system',
      )

    const messagesForAI = [
      { role: 'system', content: systemPrompt },
      ...existingMessages,
      { role: 'user', content: message },
    ]

    // ── 6. Persist user message before AI call ─────────────────────────────
    const storedMessages = [
      ...existingMessages,
      { role: 'user', content: message },
    ]
    await supabase
      .from('wizard_sessions')
      .update({ messages: storedMessages, last_error: null })
      .eq('id', session.id)

    // ── 7. Deduct coin cost ────────────────────────────────────────────────
    const runId = `wizard-chat-${session.id}-${Date.now()}`
    try {
      const costResult = await deductCost(user.id, model, runId)
      if (!costResult.success) {
        return NextResponse.json(
          { error: costResult.message },
          { status: 402 },
        )
      }
    } catch {
      // Non-fatal — continue if wallet check fails
    }

    // ── 8. Call AI ─────────────────────────────────────────────────────────
    let aiResponse: Response
    try {
      const result = await callAI({
        userId: user.id,
        provider,
        model,
        messages: messagesForAI as {
          role: 'user' | 'assistant' | 'system'
          content: string
        }[],
        stream: true,
        temperature: 0.7,
        max_tokens: 4096,
      })
      aiResponse = result as Response
    } catch (aiErr: unknown) {
      if (runId) await refundCost(user.id, model, runId)
      const wizError = classifyError(aiErr)
      await supabase
        .from('wizard_sessions')
        .update({ last_error: wizError.message })
        .eq('id', session.id)
      return NextResponse.json(
        {
          error:              wizError.type,
          message:            wizError.message,
          actionLabel:        wizError.actionLabel,
          action:             wizError.action,
          suggestModelChange: wizError.action === 'change_model',
          retryAfterSeconds:  wizError.retryAfterSeconds ?? null,
        },
        { status: wizError.type === 'rate_limit' ? 429 : 500 },
      )
    }

    if (!aiResponse.body) {
      if (runId) await refundCost(user.id, model, runId)
      return NextResponse.json(
        { error: 'stream_died', message: 'No response body from AI provider.' },
        { status: 502 },
      )
    }

    // ── 9. Transform stream ────────────────────────────────────────────────
    const decoder = new TextDecoder()
    const encoder = new TextEncoder()
    let fullAssistantText = ''
    let streamBuffer = ''
    let streamByteCount = 0

    const transformStream = new TransformStream({
      transform(chunk: Uint8Array, controller) {
        try {
          streamByteCount += chunk.length
          const text = decoder.decode(chunk, { stream: true })
          streamBuffer += text

          const lines = streamBuffer.split('\n')
          streamBuffer = lines.pop() ?? ''

          for (const line of lines) {
            const trimmed = line.trim()
            if (trimmed.startsWith('data: ') && trimmed !== 'data: [DONE]') {
              try {
                const parsed = JSON.parse(trimmed.slice(6))
                const delta = parsed?.choices?.[0]?.delta?.content
                if (delta) fullAssistantText += delta
              } catch { /* partial chunk */ }
            }
          }

          controller.enqueue(chunk)
        } catch (e) {
          console.error('[wizard/chat] Stream parse error:', e)
        }
      },

      async flush(controller) {
        // Handle remaining buffer
        if (streamBuffer.trim()) {
          const trimmed = streamBuffer.trim()
          if (trimmed.startsWith('data: ') && trimmed !== 'data: [DONE]') {
            try {
              const parsed = JSON.parse(trimmed.slice(6))
              const delta = parsed?.choices?.[0]?.delta?.content
              if (delta) fullAssistantText += delta
            } catch { /* ignore */ }
          }
        }

        // Premature stream end guard
        if (streamByteCount < 20 && fullAssistantText.length < 5) {
          const errorEvent = JSON.stringify({
            choices: [{ delta: { content: '' }, finish_reason: 'stream_error' }],
          })
          controller.enqueue(encoder.encode(`data: ${errorEvent}\n\n`))
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          await supabase
            .from('wizard_sessions')
            .update({ last_error: 'Response was cut off. Please resend.' })
            .eq('id', session.id)
          return
        }

        // ── Detect stage advance signal ──────────────────────────────────
        const nextStage = detectStageSignal(fullAssistantText)

        // ── Extract structured data — what gets saved per stage ──────────
        // IMPORTANT: confirmed_features and selected_stack are NEVER saved
        // here. They are saved only by PATCH /api/wizard/session when the
        // user explicitly confirms in the UI.
        //
        // What we DO save here:
        //   idea → features:  confirmed_idea (the idea summary)
        //   features → stack: stack_options  (the 3 options to show in UI)
        //                     (NOT confirmed_features — user must confirm)
        //   stack → generating: nothing extra (stack selection via UI only)

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sessionUpdate: Record<string, any> = {
          messages: [
            ...storedMessages,
            { role: 'assistant', content: stripSignals(fullAssistantText) },
          ],
          last_error: null,
        }

        // ── Idea stage: save confirmed_idea when advancing to features ────
        // Also extract features and stacks from synthesis for the UI to show
        let uiFeatures: ConfirmedFeature[] | null = null
        let uiStacks: TechStackOption[] | null = null

        if (nextStage === 'features') {
          const ideaData = extractIdeaData(fullAssistantText)
          if (ideaData) {
            sessionUpdate.confirmed_idea = ideaData.summary
          }
          // Extract features from the synthesis — sent to UI via meta event
          // but NOT saved to DB (user must confirm first)
          uiFeatures = extractFeaturesData(fullAssistantText)
          uiStacks   = extractStackOptions(fullAssistantText)

          // Save stack_options to session so right panel can restore on refresh
          if (uiStacks) {
            sessionUpdate.stack_options = uiStacks
          }

          // Advance stage
          sessionUpdate.stage = nextStage
          sessionUpdate.completed_stages = [
            ...(session.completed_stages ?? []),
            currentStage,
          ]
        }

        // ── Features stage: save stack_options when advancing to stack ────
        // (In practice this stage is rarely advanced via chat signal —
        //  it's advanced by the user clicking Confirm Features button.
        //  But if the user somehow triggers it in chat, handle gracefully.)
        if (nextStage === 'stack') {
          sessionUpdate.stage = nextStage
          sessionUpdate.completed_stages = [
            ...(session.completed_stages ?? []),
            currentStage,
          ]
        }

        // ── Stack stage: advance to generating ───────────────────────────
        // (In practice this is triggered by UI button, not chat signal)
        if (nextStage === 'generating') {
          sessionUpdate.stage = nextStage
          sessionUpdate.status = 'generating'
          sessionUpdate.generation_status = 'idle'
          sessionUpdate.completed_stages = [
            ...(session.completed_stages ?? []),
            currentStage,
          ]
        }

        await supabase
          .from('wizard_sessions')
          .update(sessionUpdate)
          .eq('id', session.id)

        // ── Send meta event to client ─────────────────────────────────────
        // The client uses this to update stage state and render the right
        // panel without a DB round-trip.
        const cleanedText = stripSignals(fullAssistantText)
        const metaEvent = JSON.stringify({
          __wizard_meta:  true,
          sessionId:      session.id,
          stage:          nextStage ?? currentStage,
          stageAdvanced:  nextStage !== null,
          nextStage:      nextStage ?? null,
          cleanedText,
          // uiFeatures and uiStacks are sent to client for right panel
          // rendering ONLY. They are NOT confirmed until user clicks confirm.
          uiFeatures:     uiFeatures ?? null,
          uiStacks:       uiStacks ?? null,
        })

        controller.enqueue(
          encoder.encode(`data: ${metaEvent}\n\ndata: [DONE]\n\n`),
        )
      },
    })

    return new Response(aiResponse.body.pipeThrough(transformStream), {
      headers: {
        'Content-Type':  'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection':    'keep-alive',
        'X-Session-Id':  session.id,
        'X-Stage':       currentStage,
      },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[wizard/chat] Error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  detectMentionedStack — scans user messages for tech stack keywords
// ─────────────────────────────────────────────────────────────────────────────

function detectMentionedStack(allUserText: string): string | null {
  const lower = allUserText.toLowerCase()

  const patterns: [RegExp, string][] = [
    [/next\.?js/i, 'Next.js'],
    [/nuxt/i, 'Nuxt'],
    [/remix/i, 'Remix'],
    [/svelte/i, 'SvelteKit'],
    [/vue/i, 'Vue'],
    [/angular/i, 'Angular'],
    [/react\s*native|expo/i, 'React Native / Expo'],
    [/flutter/i, 'Flutter'],
    [/django/i, 'Django'],
    [/rails|ruby\s*on\s*rails/i, 'Ruby on Rails'],
    [/laravel/i, 'Laravel'],
    [/fastapi|fast\s*api/i, 'FastAPI'],
    [/express/i, 'Express'],
    [/nestjs|nest\.?js/i, 'NestJS'],
    [/supabase/i, 'Supabase'],
    [/firebase/i, 'Firebase'],
    [/prisma/i, 'Prisma'],
    [/mongodb|mongo/i, 'MongoDB'],
    [/postgres|postgresql/i, 'PostgreSQL'],
    [/mysql/i, 'MySQL'],
    [/redis/i, 'Redis'],
    [/kubernetes|k8s/i, 'Kubernetes'],
    [/docker/i, 'Docker'],
    [/aws|amazon\s*web\s*services/i, 'AWS'],
    [/gcp|google\s*cloud/i, 'GCP'],
    [/azure/i, 'Azure'],
    [/vercel/i, 'Vercel'],
    [/railway/i, 'Railway'],
    [/t3\s*stack/i, 'T3 Stack'],
  ]

  const found: string[] = []
  for (const [pattern, name] of patterns) {
    if (pattern.test(lower) && !found.includes(name)) found.push(name)
  }

  if (found.length === 0) return null
  return found.slice(0, 3).join(' + ')
}
