import { NextResponse } from 'next/server'
import { getServiceSupabase, supabase as clientSupabase, verifyProjectAccess } from '@/lib/supabase'
import { callAI } from '@/lib/ai-client'
import { awardCoins, deductCost, refundCost, MODEL_COSTS } from '@/lib/wallet'
import type { AIProvider } from '@/lib/ai-client'
import {
  buildGenerationPrompts,
  classifyError,
  getFallbackStackOptions,
  GENERATION_STEPS,
  type GenerationContext,
  type ConfirmedFeature,
  type TechStackOption,
} from '@/lib/wizard-stages'

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/wizard/generate
//
//  Executes the blueprint generation pipeline using confirmed wizard data.
//
//  PARALLEL WAVE ARCHITECTURE:
//    Wave 1 (parallel): Step 0 (Architecture) + Step 1 (Phases & Features)
//    Wave 2 (parallel): Step 2 (Feature Prompts) + Step 3 (Phase Prompts)
//    Wave 3 (serial):   Step 4 (Master Prompt) — depends on Wave 1 outputs
//    Save:              Bulk DB inserts — phases, features, prompts, contexts
//
//  KEY CHANGE vs old version:
//    - targetAudience removed from generation context
//    - markdownFiles bulk-saved to contexts table (makes local injection possible)
//    - wizard_sessions.messages cleared on first completion (not regeneration)
//    - All DB writes use bulk insert([...]) not sequential per-row inserts
//
//  SSE events emitted:
//    { type: 'wave_start',    wave: 1, steps: [0,1] }
//    { type: 'step_start',    step: 0, label: '...' }
//    { type: 'step_complete', step: 0, label: '...' }
//    { type: 'step_error',    step: 0, error: '...', fatal: false }
//    { type: 'saving' }
//    { type: 'complete', blueprint: { ... } }
//    { type: 'error',    error: '...', action: '...' }
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic   = 'force-dynamic'
export const maxDuration = 300

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

  const uid = user.id

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: {
    sessionId:  string
    projectId:  string
    provider:   AIProvider
    model:      string
    resumeStep?: number
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const {
    sessionId,
    projectId,
    provider   = 'groq',
    model      = 'llama-3.3-70b-versatile',
    resumeStep = 0,
  } = body

  if (!sessionId || !projectId)
    return NextResponse.json(
      { error: 'sessionId and projectId are required' },
      { status: 400 },
    )

  if (!await verifyProjectAccess(user.id, projectId))
    return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const supabase = getServiceSupabase()

  // ── Load session ──────────────────────────────────────────────────────────
  const { data: session } = await supabase
    .from('wizard_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('project_id', projectId)
    .single()

  if (!session)
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })

  if (session.stage !== 'generating' && session.stage !== 'complete')
    return NextResponse.json(
      {
        error: 'session_not_ready',
        message: `Session is at stage "${session.stage}". Complete all wizard stages first.`,
      },
      { status: 409 },
    )

  const isRegeneration =
    session.stage === 'complete' ||
    session.generation_status === 'complete'

  // ── Load project name + git integration fields ────────────────────────────
  const { data: project } = await supabase
    .from('projects')
    .select('name, repo_url, editor_preference')
    .eq('id', projectId)
    .single()

  const projectName       = project?.name ?? 'Untitled Project'
  const repoUrl           = (project as { repo_url?: string | null } | null)?.repo_url ?? null
  const editorPreference  = (project as { editor_preference?: string | null } | null)
    ?.editor_preference ?? 'generic'

  // ── Optionally enrich wizard context from public repo metadata ────────────
  // Non-fatal — if GitHub is unreachable or repo is private, generation continues
  let repoEnrichment = ''
  if (repoUrl) {
    try {
      const { enrichProjectFromRepo } = await import('@/lib/github')
      const { metadata, stack } = await enrichProjectFromRepo(repoUrl)
      if (metadata) {
        const topicsStr = metadata.topics.length > 0
          ? `Topics: ${metadata.topics.join(', ')}`
          : ''
        repoEnrichment = [
          metadata.description ? `Repo description: ${metadata.description}` : '',
          metadata.language    ? `Primary language: ${metadata.language}` : '',
          topicsStr,
        ].filter(Boolean).join('\n')
      }
      if (stack.detected.length > 0) {
        repoEnrichment += `\nDetected from repo: ${stack.detected.join(', ')} (${stack.confidence} confidence)`
      }
    } catch {
      // Non-fatal — enrichment is best-effort
    }
  }

  // ── Build generation context ──────────────────────────────────────────────
  // targetAudience removed — inferred from idea + features by the AI
  const confirmedFeatures: ConfirmedFeature[] = session.confirmed_features ?? []
  const selectedStack: TechStackOption | null  = session.selected_stack?.id
    ? (session.selected_stack as TechStackOption)
    : null
  const confirmedIdea: string = session.confirmed_idea ?? 'No idea summary available'
  const effectiveStack: TechStackOption = selectedStack ?? getFallbackStackOptions()[0]

  // ── Pre-flight coin check ─────────────────────────────────────────────────
  // Blueprint generation makes 5 AI calls. Estimate minimum cost:
  // Steps 0+1 use user's selected model, steps 2-4 use 8B light model.
  // Check user has at least enough for steps 0+1 before starting.
  const stepModelCost = MODEL_COSTS[model] ?? { currency: 'coins', amount: 1, tier: 'free' }
  if (stepModelCost.currency === 'coins') {
    const { getWallet, applyDailyReset } = await import('@/lib/wallet')
    try {
      await applyDailyReset(user.id)
      const wallet = await getWallet(user.id)
      const minRequired = stepModelCost.amount * 2 // at minimum steps 0 + 1
      if (wallet.coins < minRequired) {
        return NextResponse.json(
          {
            error: 'insufficient_balance',
            message: `Not enough coins to generate a blueprint. You have ${wallet.coins} coins but need at least ${minRequired}. Your daily allowance resets at midnight UTC.`,
          },
          { status: 402 },
        )
      }
    } catch { /* non-fatal — continue if wallet check fails */ }
  }

  // Conversation summary — last 6 non-system messages for extra context
  const conversationSummary: string = (session.messages ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((m: any) => m.role !== 'system')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .slice(-6)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((m: any) => `${m.role.toUpperCase()}: ${(m.content as string).slice(0, 300)}`)
    .join('\n\n')

  const generationCtx: GenerationContext = {
    projectName,
    confirmedIdea: repoEnrichment
      ? `${confirmedIdea}\n\nGITHUB REPO CONTEXT:\n${repoEnrichment}`
      : confirmedIdea,
    confirmedFeatures,
    targetAudience: session.target_audience ?? '',
    selectedStack:     effectiveStack,
    conversationSummary,
    repoUrl,
    editorPreference,
  }

  const generationPrompts = buildGenerationPrompts(generationCtx)

  // ── Mark session as generating ────────────────────────────────────────────
  await supabase
    .from('wizard_sessions')
    .update({ generation_status: 'generating', generation_step: resumeStep, last_error: null })
    .eq('id', sessionId)

  // ── Helpers ───────────────────────────────────────────────────────────────
  const encoder = new TextEncoder()

  function sseEvent(data: Record<string, unknown>): Uint8Array {
    return encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
  }

  // Robust JSON extractor — strips markdown fences, trailing commas
  function extractJSON(raw: string): unknown | null {
    let s = raw
      .replace(/^```(?:json|javascript|js)?\s*/gim, '')
      .replace(/```\s*$/gm, '')
      .trim()
    const first = s.indexOf('{')
    const last  = s.lastIndexOf('}')
    if (first === -1 || last === -1) return null
    s = s.slice(first, last + 1)
    try {
      return JSON.parse(s)
    } catch {
      try {
        const fixed = s
          .replace(/,(\s*[}\]])/g, '$1')
          .replace(/([^\\])\\'/g, "$1'")
        return JSON.parse(fixed)
      } catch {
        return null
      }
    }
  }

  // ── Run one generation step ───────────────────────────────────────────────
  // Returns parsed JSON on success, null on failure.
  // Emits step_start, step_complete, step_error SSE events.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function runStep(
    prompt: ReturnType<typeof buildGenerationPrompts>[0],
    controller: ReadableStreamDefaultController,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    extraContext?: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<Record<string, any> | null> {
    controller.enqueue(sseEvent({
      type:        'step_start',
      step:        prompt.step,
      label:       prompt.label,
      description: GENERATION_STEPS[prompt.step]?.description ?? '',
      wave:        prompt.wave,
    }))

    await supabase
      .from('wizard_sessions')
      .update({ generation_step: prompt.step })
      .eq('id', sessionId)

    const stepProvider = (prompt.lightModel?.provider ?? provider) as AIProvider
    const stepModel    = prompt.lightModel?.model ?? model
    const stepRunId    = `wizard-gen-${sessionId}-step${prompt.step}-${Date.now()}`

    try { await deductCost(uid, stepModel, stepRunId) } catch { /* non-fatal */ }

    const stepMessages = [
      { role: 'system' as const, content: prompt.systemPrompt },
      {
        role: 'user' as const,
        content: extraContext
          ? `${prompt.userPrompt}\n\n${extraContext}`
          : prompt.userPrompt,
      },
    ]

    let rawContent = ''
    try {
      const aiResponse = await callAI({
        userId:      uid,
        provider:    stepProvider,
        model:       stepModel,
        messages:    stepMessages,
        stream:      false,
        temperature: 0.3,
        max_tokens:  prompt.maxTokens ?? 4096,
      })
      rawContent = aiResponse?.choices?.[0]?.message?.content ?? ''
    } catch (aiErr: unknown) {
      try { await refundCost(uid, stepModel, stepRunId) } catch { /* non-fatal */ }
      const wizError = classifyError(aiErr)
      const isFatal  = prompt.step <= 1
      controller.enqueue(sseEvent({
        type: 'step_error', step: prompt.step, label: prompt.label,
        error: wizError.message, errorType: wizError.type,
        action: wizError.action, fatal: isFatal, resumeStep: prompt.step,
      }))
      if (isFatal) throw new Error(`Fatal step ${prompt.step}: ${wizError.message}`)
      return null
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed = extractJSON(rawContent) as Record<string, any> | null
    if (!parsed) {
      try { await refundCost(uid, stepModel, stepRunId) } catch { /* non-fatal */ }
      const isFatal = prompt.step <= 1
      controller.enqueue(sseEvent({
        type: 'step_error', step: prompt.step, label: prompt.label,
        error: 'AI returned invalid JSON.', errorType: 'parse_failed',
        action: 'change_model', fatal: isFatal, resumeStep: prompt.step,
      }))
      if (isFatal) throw new Error(`Fatal step ${prompt.step}: invalid JSON from AI`)
      return null
    }

    controller.enqueue(sseEvent({ type: 'step_complete', step: prompt.step, label: prompt.label }))

    // Brief pause between steps to avoid TPM rate limits
    // when the previous step consumed significant tokens
    if (prompt.step < 4) { // 4 is the last step index
      await new Promise(r => setTimeout(r, 2000))
    }

    return parsed
  }

  // ── Accumulated blueprint ─────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blueprint: Record<string, any> = {
    architecture:     '',
    techStack: {
      frontend: effectiveStack.frontend,
      backend:  effectiveStack.backend,
      database: effectiveStack.database,
      hosting:  effectiveStack.hosting,
      other:    effectiveStack.other,
    },
    markdownFiles:    {} as Record<string, string>,
    phases:           [],
    agentAssignments: {},
    featurePrompts:   {},
    phasePrompts:     {},
    masterPrompt:     '',
    masterPromptTitle:'',
    contextFilesIndex:{},
  }

  // ── Main streaming function ───────────────────────────────────────────────
  const stream = new ReadableStream({
    async start(controller) {
      try {

        // ════════════════════════════════════════════════════════════════════
        //  WAVE 1 — Architecture + Phases run in parallel
        //  Both are independent of each other.
        //  Architecture needs only: idea, features, stack
        //  Phases needs only:       idea, features, stack
        // ════════════════════════════════════════════════════════════════════
        controller.enqueue(sseEvent({ type: 'wave_start', wave: 1, steps: [0, 1] }))

        const [archResult, phasesResult] = await Promise.all([
          runStep(generationPrompts[0], controller),
          runStep(generationPrompts[1], controller),
        ])

        // Merge Wave 1 results into blueprint
        if (archResult) {
          blueprint.architecture = archResult.architecture ?? ''
          if (archResult.markdownFiles && typeof archResult.markdownFiles === 'object') {
            Object.assign(blueprint.markdownFiles, archResult.markdownFiles)
          }
        }

        if (phasesResult) {
          if (Array.isArray(phasesResult.phases) && phasesResult.phases.length > 0) {
            blueprint.phases = phasesResult.phases
          } else {
            // Fatal: no phases means nothing to build
            controller.enqueue(sseEvent({
              type: 'error',
              error: 'No development phases were generated. Add more project detail and try again.',
              action: 'retry',
              resumeStep: 1,
            }))
            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
            controller.close()
            await supabase
              .from('wizard_sessions')
              .update({ generation_status: 'partial', last_error: 'No phases generated.' })
              .eq('id', sessionId)
            return
          }
          if (phasesResult.agentAssignments && typeof phasesResult.agentAssignments === 'object') {
            Object.assign(blueprint.agentAssignments, phasesResult.agentAssignments)
          }
        }

        // ════════════════════════════════════════════════════════════════════
        //  WAVE 2 — Feature Prompts + Phase Prompts run in parallel
        //  Both depend on Wave 1 phases output.
        // ════════════════════════════════════════════════════════════════════
        controller.enqueue(sseEvent({ type: 'wave_start', wave: 2, steps: [2, 3] }))

        const phaseContext = blueprint.phases.length > 0
          ? `PHASES FROM STEP 1:\n${JSON.stringify(blueprint.phases, null, 2)}`
          : ''

        const [featurePromptsResult, phasePromptsResult] = await Promise.all([
          runStep(generationPrompts[2], controller, phaseContext),
          runStep(generationPrompts[3], controller, phaseContext),
        ])

        if (featurePromptsResult?.featurePrompts &&
            typeof featurePromptsResult.featurePrompts === 'object') {
          blueprint.featurePrompts = featurePromptsResult.featurePrompts
          for (const [name, data] of
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              Object.entries<any>(featurePromptsResult.featurePrompts)) {
            const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
            blueprint.markdownFiles[`prompts/feature-${slug}.md`] =
              buildFeaturePromptMarkdown(name, data)
          }
        }

        if (phasePromptsResult?.phasePrompts &&
            typeof phasePromptsResult.phasePrompts === 'object') {
          blueprint.phasePrompts = phasePromptsResult.phasePrompts
          for (const [name, data] of
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              Object.entries<any>(phasePromptsResult.phasePrompts)) {
            const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
            blueprint.markdownFiles[`prompts/phase-${slug}.md`] =
              buildPhasePromptMarkdown(name, data)
          }
        }

        // ════════════════════════════════════════════════════════════════════
        //  WAVE 3 — Master Prompt (serial, needs both Wave 1 outputs)
        // ════════════════════════════════════════════════════════════════════
        controller.enqueue(sseEvent({ type: 'wave_start', wave: 3, steps: [4] }))

        const masterContext = `ARCHITECTURE SUMMARY:\n${blueprint.architecture.slice(0, 800)}\n\nPHASES:\n${JSON.stringify(blueprint.phases, null, 2)}`
        const masterResult  = await runStep(generationPrompts[4], controller, masterContext)

        if (masterResult) {
          blueprint.masterPrompt      = masterResult.masterPrompt ?? ''
          blueprint.masterPromptTitle = masterResult.masterPromptTitle ?? `Master Context: ${projectName}`
          if (masterResult.contextFilesIndex) {
            blueprint.contextFilesIndex = masterResult.contextFilesIndex
          }
          if (blueprint.masterPrompt) {
            blueprint.markdownFiles['prompts/master-prompt.md'] =
              `# ${blueprint.masterPromptTitle}\n\n${blueprint.masterPrompt}`
          }
        }

        // ════════════════════════════════════════════════════════════════════
        //  SAVE — Bulk DB inserts
        // ════════════════════════════════════════════════════════════════════
        controller.enqueue(sseEvent({ type: 'saving', message: 'Saving blueprint...' }))

        await saveBlueprint({
          supabase,
          projectId,
          projectName,
          blueprint,
          isRegeneration,
        })

        // ── Mark session complete ─────────────────────────────────────────
        // On FIRST completion: clear messages (ephemeral chat data no longer needed)
        // On REGENERATION: keep messages (user may have given refinement instructions)
        const sessionFinalUpdate: Record<string, unknown> = {
          stage:             'complete',
          status:            'complete',
          generation_status: 'complete',
          generation_step:   GENERATION_STEPS.length,
          architecture:      { description: blueprint.architecture },
          workflow:          blueprint.techStack,
          last_error:        null,
        }
        if (!isRegeneration) {
          sessionFinalUpdate.messages = []
        }

        await supabase
          .from('wizard_sessions')
          .update(sessionFinalUpdate)
          .eq('id', sessionId)

        // ── Award coins ───────────────────────────────────────────────────
        try {
          await awardCoins(uid, 'wizard_complete', projectId)
        } catch { /* non-fatal */ }

        // ── Emit complete ─────────────────────────────────────────────────
        controller.enqueue(sseEvent({
          type:      'complete',
          blueprint: {
            architecture:      blueprint.architecture,
            techStack:         blueprint.techStack,
            phases:            blueprint.phases,
            markdownFiles:     blueprint.markdownFiles,
            masterPromptTitle: blueprint.masterPromptTitle,
          },
        }))
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()

      } catch (fatalErr: unknown) {
        console.error('[wizard/generate] Fatal error:', fatalErr)
        const wizError = classifyError(fatalErr)
        try {
          await supabase
            .from('wizard_sessions')
            .update({ generation_status: 'failed', last_error: wizError.message })
            .eq('id', sessionId)
        } catch { /* ignore */ }
        controller.enqueue(sseEvent({
          type:               'error',
          error:              wizError.message,
          action:             wizError.action,
          suggestModelChange: wizError.action === 'change_model',
        }))
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
      'X-Session-Id':  sessionId,
    },
  })
}

// ─────────────────────────────────────────────────────────────────────────────
//  saveBlueprint — bulk DB inserts
//
//  DB writes per generation (bulk, not per-row):
//    1. DELETE stale data (5 deletes — same as before)
//    2. INSERT master prompt (1 insert)
//    3. INSERT all phases (1 bulk insert)
//    4. INSERT all features (1 bulk insert, after phase IDs resolved)
//    5. INSERT all graph_nodes (1 bulk insert)
//    6. INSERT all prompts: phase + feature (1 bulk insert)
//    7. INSERT all context files to contexts table (1 bulk insert) ← NEW
//    Total: 5 deletes + 7 inserts = 12 operations vs old 26+ sequential
// ─────────────────────────────────────────────────────────────────────────────

async function saveBlueprint(params: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
  projectId: string
  projectName: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  blueprint: Record<string, any>
  isRegeneration: boolean
}) {
  const { supabase, projectId, projectName, blueprint } = params

  // Run all 6 deletes in parallel: same project-scoped cleanup
  await Promise.all([
    'graph_edges', 'graph_nodes', 'prompts', 'features', 'phases', 'contexts',
  ].map(t => supabase.from(t).delete().eq('project_id', projectId)))

  // ── 2. Insert master prompt ───────────────────────────────────────────────
  if (blueprint.masterPrompt) {
    await supabase.from('prompts').insert({
      project_id:        projectId,
      is_master_prompt:  true,
      title:             blueprint.masterPromptTitle || `Master Context: ${projectName}`,
      raw_prompt:        blueprint.masterPrompt,
      structured_prompt: blueprint.masterPrompt,
      prompt_type:       'MASTER',
      context_files:     Object.keys(blueprint.contextFilesIndex ?? {}),
    })
  }

  // ── 3. Insert phases (bulk) ───────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const phases: any[] = blueprint.phases ?? []
  if (phases.length === 0) {
    throw new Error('Blueprint contains no phases. Cannot save empty blueprint.')
  }

  const phaseRows = phases.map((phase, pIdx) => ({
    project_id:  projectId,
    name:        phase.name,
    description: phase.description ?? '',
    order_index: phase.order_index ?? pIdx,
    status:      'planned',
  }))

  const { data: insertedPhases, error: phaseErr } = await supabase
    .from('phases')
    .insert(phaseRows)
    .select('id, name, order_index')

  if (phaseErr) throw phaseErr

  // Build phase name → DB id map for linking features and prompts
  const phaseIdMap: Record<string, string> = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const p of (insertedPhases ?? []) as any[]) {
    phaseIdMap[p.name] = p.id
  }

  // ── 4. Insert features (bulk) ─────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const featureRows: any[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const phaseFeatureMap: Record<string, any[]> = {}

  for (let pIdx = 0; pIdx < phases.length; pIdx++) {
    const phase = phases[pIdx]
    const phaseId = phaseIdMap[phase.name]
    if (!phaseId) continue

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const phaseFeatures: any[] = Array.isArray(phase.features) ? phase.features : []
    phaseFeatureMap[phaseId] = phaseFeatures

    for (let fIdx = 0; fIdx < phaseFeatures.length; fIdx++) {
      const feature = phaseFeatures[fIdx]
      featureRows.push({
        project_id:     projectId,
        phase_id:       phaseId,
        name:           feature.name,
        description:    feature.description ?? '',
        type:           feature.type ?? 'frontend',
        status:         'planned',
        priority:       fIdx + 1,
        assigned_model: blueprint.agentAssignments?.[feature.name] ?? 'llama-3.1-8b-instant',
      })
    }
  }

  let insertedFeatures: { id: string; name: string; phase_id: string }[] = []
  if (featureRows.length > 0) {
    const { data, error: featErr } = await supabase
      .from('features')
      .insert(featureRows)
      .select('id, name, phase_id')
    if (featErr) throw featErr
    insertedFeatures = data ?? []
  }

  // Build feature name → DB id map for linking prompts
  const featureIdMap: Record<string, string> = {}
  for (const f of insertedFeatures) {
    featureIdMap[f.name] = f.id
  }

  // ── 5. Insert graph nodes (bulk) ──────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graphNodeRows: any[] = []

  // Project node
  graphNodeRows.push({
    project_id: projectId,
    type:       'project',
    label:      projectName,
    status:     'planned',
    position_x: 0,
    position_y: 0,
    metadata:   { original_id: `project-${projectId}` },
  })

  // Phase nodes
  for (let pIdx = 0; pIdx < phases.length; pIdx++) {
    const phase   = phases[pIdx]
    const phaseId = phaseIdMap[phase.name]
    if (!phaseId) continue
    graphNodeRows.push({
      project_id: projectId,
      type:       'phase',
      label:      phase.name,
      status:     'planned',
      position_x: pIdx * 340,
      position_y: 220,
      metadata: {
        original_id: `phase-${phaseId}`,
        phase_id:    phaseId,
        order_index: pIdx,
      },
    })

    // Feature nodes
    const phaseFeatures = phaseFeatureMap[phaseId] ?? []
    for (let fIdx = 0; fIdx < phaseFeatures.length; fIdx++) {
      const feature   = phaseFeatures[fIdx]
      const featureId = featureIdMap[feature.name]
      if (!featureId) continue
      graphNodeRows.push({
        project_id: projectId,
        type:       'feature',
        label:      feature.name,
        status:     'planned',
        position_x: (pIdx * 340) + (fIdx % 2 === 0 ? -120 : 120),
        position_y: 420 + Math.floor(fIdx / 2) * 160,
        metadata: {
          original_id: `feature-${featureId}`,
          feature_id:  featureId,
          phase_id:    phaseId,
          type:        feature.type,
        },
      })
    }
  }

  if (graphNodeRows.length > 0) {
    const { error: nodeErr } = await supabase
      .from('graph_nodes')
      .insert(graphNodeRows)
    if (nodeErr) console.warn('[saveBlueprint] graph_nodes insert error:', nodeErr)
  }

  // ── 6. Insert prompts (bulk) ──────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const promptRows: any[] = []

  for (const phase of phases) {
    const phaseId = phaseIdMap[phase.name]
    if (!phaseId) continue

    // Phase overview prompt
    const phasePromptData = blueprint.phasePrompts?.[phase.name]
    if (phasePromptData) {
      promptRows.push({
        project_id:        projectId,
        phase_id:          phaseId,
        feature_id:        null,
        title:             phasePromptData.title ?? `Phase: ${phase.name}`,
        raw_prompt:        phasePromptData.overviewPrompt ?? '',
        structured_prompt: phasePromptData.overviewPrompt ?? '',
        prompt_type:       'PHASE_OVERVIEW',
        checklist:         phasePromptData.completionChecklist ?? [],
        context_files:     ['context/architecture.md', 'context/tech-stack.md'],
      })
    }

    // Feature build prompts
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const phaseFeatures: any[] = phaseFeatureMap[phaseId] ?? []
    for (const feature of phaseFeatures) {
      const featureId       = featureIdMap[feature.name]
      const featurePromptData = blueprint.featurePrompts?.[feature.name]
      if (featurePromptData && featureId) {
        promptRows.push({
          project_id:        projectId,
          phase_id:          phaseId,
          feature_id:        featureId,
          title:             featurePromptData.title ?? `Build: ${feature.name}`,
          raw_prompt:        featurePromptData.buildPrompt ?? '',
          structured_prompt: featurePromptData.buildPrompt ?? '',
          prompt_type:       'FEATURE_BUILD',
          context_files:     featurePromptData.contextFilesNeeded ?? [],
          checklist:         featurePromptData.checklist ?? [],
          expected_output:   featurePromptData.expectedOutput ?? '',
          model_suggested:   featurePromptData.modelSuggested ?? null,
        })
      }
    }
  }

  if (promptRows.length > 0) {
    const { error: promptErr } = await supabase
      .from('prompts')
      .insert(promptRows)
    if (promptErr) console.warn('[saveBlueprint] prompts insert error:', promptErr)
  }

  // ── 7. Insert context files to contexts table (NEW) ───────────────────────
  // Bulk upsert all generated markdown files so they are available to
  // PAM, the agent, the sync engine, and the context page without
  // requiring local folder injection first.
  if (blueprint.markdownFiles &&
      typeof blueprint.markdownFiles === 'object' &&
      Object.keys(blueprint.markdownFiles).length > 0) {
    const now = new Date().toISOString()
    const contextRows = await Promise.all(
      Object.entries(blueprint.markdownFiles).map(
        async ([filePath, content]) => {
          // Extract summary from <!-- REMINISCE:SUMMARY ... --> tag
          const summaryMatch = (content as string).match(
            /<!--\s*REMINISCE:SUMMARY\s*([\s\S]*?)\s*-->/i,
          )
          const summaryLines = summaryMatch
            ? summaryMatch[1]
                .split('\n')
                .map((l: string) => l.trim())
                .filter(
                  (l: string) =>
                    l.length > 0 &&
                    !l.startsWith('OWNED_BY') &&
                    !l.startsWith('LAST_UPDATED') &&
                    !l.startsWith('VERSION'),
                )
            : []
          const summary = summaryLines.join(' ').trim() || null

          // Determine ownership from path
          const ownedBy =
            filePath.includes('/logs/') ? 'developer'
            : filePath.includes('CLAUDE.md') ||
              filePath.includes('.cursorrules') ||
              filePath.includes('copilot-instructions') ||
              filePath.includes('.windsurfrules') ||
              filePath.includes('reminisce-context.md')
              ? 'shared'
              : 'reminisce'

          return {
            project_id:     projectId,
            file_path:      filePath,
            content:        content as string,
            summary,
            owned_by:       ownedBy,
            last_modified:  now,
            last_synced_at: now,
          }
        },
      ),
    )

    // Delete existing context rows for this project then bulk insert fresh
    await supabase.from('contexts').delete().eq('project_id', projectId)
    if (contextRows.length > 0) {
      const { error: ctxErr } = await supabase
        .from('contexts')
        .insert(contextRows)
      if (ctxErr) {
        // Non-fatal — blueprint is saved, context files can be re-injected
        console.error('[saveBlueprint] contexts insert failed:', ctxErr.message)
      } else {
        // Bulk context files saved successfully
      }
    }
  }

  // ── Generate workflow files from saved phase/feature data ────────────
  // These are programmatic, not AI-generated. They mirror the current
  // DB state and are updated on every regeneration.
  try {
    const workflowPhaseLines: string[] = [
      '<!-- REMINISCE:SUMMARY',
      'Current project timeline showing all phases, their status, and feature counts. Updated automatically when phases change or features are completed. Reference when: asking about progress, what to build next, phase dependencies.',
      'OWNED_BY: reminisce | LAST_UPDATED: AUTO',
      '-->',
      '# Project Timeline',
      '',
      `**Project:** ${params.projectName}`,
      `**Generated:** ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`,
      '',
    ]

    const workflowFeatureLines: string[] = [
      '<!-- REMINISCE:SUMMARY',
      'Complete feature list grouped by phase with statuses and type. Updated when PAM changes feature status or phases are modified. Reference when: checking what needs building, feature assignments, completion tracking.',
      'OWNED_BY: reminisce | LAST_UPDATED: AUTO',
      '-->',
      '# Feature Roadmap',
      '',
    ]

    for (const phase of (blueprint.phases ?? [])) {
      const features = Array.isArray(phase.features) ? phase.features : []
      workflowPhaseLines.push(`## ${phase.name}`)
      workflowPhaseLines.push(`*${phase.description ?? ''}*`)
      workflowPhaseLines.push('')
      features.forEach((f: { name: string; priority?: string }) => {
        workflowPhaseLines.push(`- [ ] ${f.name}${f.priority === 'core' ? ' *(core)*' : ''}`)
      })
      workflowPhaseLines.push('')

      workflowFeatureLines.push(`## ${phase.name}`)
      features.forEach((f: { name: string; type?: string; priority?: string }) => {
        workflowFeatureLines.push(
          `- **${f.name}** \`${f.type ?? 'feature'}\` [${f.priority ?? 'core'}] — planned`,
        )
        const slug = f.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
        workflowFeatureLines.push(
          `  → prompt: \`reminisce/prompts/features/${slug}.md\``,
        )
      })
      workflowFeatureLines.push('')
    }

    const workflowNow = new Date().toISOString()
    await supabase.from('contexts').upsert(
      [
        {
          project_id:     projectId,
          file_path:      'reminisce/workflow/phases.md',
          content:        workflowPhaseLines.join('\n'),
          summary:        'Current project timeline showing all phases and feature counts.',
          owned_by:       'reminisce',
          last_modified:  workflowNow,
          last_synced_at: workflowNow,
        },
        {
          project_id:     projectId,
          file_path:      'reminisce/workflow/features.md',
          content:        workflowFeatureLines.join('\n'),
          summary:        'Complete feature list grouped by phase with statuses and type.',
          owned_by:       'reminisce',
          last_modified:  workflowNow,
          last_synced_at: workflowNow,
        },
      ],
      { onConflict: 'project_id,file_path' },
    )
  } catch (wfErr) {
    // Non-fatal
    console.error('[saveBlueprint] workflow files failed:', wfErr)
  }

  // ── Log summary ───────────────────────────────────────────────────────────
}

// ─────────────────────────────────────────────────────────────────────────────
//  Markdown builders
// ─────────────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildFeaturePromptMarkdown(name: string, data: any): string {
  const lines: string[] = [`# ${name} — Build Prompt`, '', '## Prompt', data.buildPrompt ?? '', '']
  if (data.contextFilesNeeded?.length) {
    lines.push('## Context Files')
    for (const f of data.contextFilesNeeded) lines.push(`- ${f}`)
    lines.push('')
  }
  if (data.expectedOutput) {
    lines.push('## Expected Output', data.expectedOutput, '')
  }
  if (data.checklist?.length) {
    lines.push('## Completion Checklist')
    for (const item of data.checklist) lines.push(`- [ ] ${item}`)
    lines.push('')
  }
  if (data.modelSuggested) {
    lines.push(`## Suggested Model\n\`${data.modelSuggested}\``)
  }
  return lines.join('\n')
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildPhasePromptMarkdown(name: string, data: any): string {
  const lines: string[] = [`# ${name} — Phase Overview`, '', '## Overview Prompt', data.overviewPrompt ?? '', '']
  if (data.completionChecklist?.length) {
    lines.push('## Completion Checklist')
    for (const item of data.completionChecklist) lines.push(`- [ ] ${item}`)
    lines.push('')
  }
  if (data.estimatedWeeks) {
    lines.push(`## Estimated Duration\n${data.estimatedWeeks} week(s)`)
  }
  return lines.join('\n')
}
