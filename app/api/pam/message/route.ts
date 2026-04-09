import { NextResponse } from 'next/server'
import { getServiceSupabase, supabase as clientSupabase, verifyProjectAccess } from '@/lib/supabase'
import { callAI, userHasOwnKey } from '@/lib/ai-client'
import type { AIProvider } from '@/lib/ai-client'
import { deductCost, refundCost, ensureWallet } from '@/lib/wallet'

export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────────────────────
//  Smart context loader
//  Detects keywords in the user message and returns the file paths
//  that should be fully loaded for this turn.
//  All other files get summary-only injection to save tokens.
// ─────────────────────────────────────────────────────────────────────────────

const SMART_LOAD_RULES: Array<{ keywords: RegExp; filePath: string }> = [
  {
    keywords: /architect|component|system design|data flow|structure|integrat/i,
    filePath: 'reminisce/context/architecture.md',
  },
  {
    keywords: /stack|framework|library|dependenc|version|package|npm|pip|install/i,
    filePath: 'reminisce/context/tech-stack.md',
  },
  {
    keywords: /convention|style|pattern|folder|naming|guideline|lint|format/i,
    filePath: 'reminisce/context/coding-guidelines.md',
  },
  {
    keywords: /scope|v1|out of scope|roadmap|success metric|what.*build|should.*include/i,
    filePath: 'reminisce/context/product-scope.md',
  },
]

function detectSmartLoadPaths(userMessage: string): string[] {
  return SMART_LOAD_RULES
    .filter(rule => rule.keywords.test(userMessage))
    .map(rule => rule.filePath)
}

// ─────────────────────────────────────────────────────────────────────────────
//  System prompt builder — tiered context injection
// ─────────────────────────────────────────────────────────────────────────────

function buildSystemPrompt(ctx: {
  projectName:       string
  projectDesc:       string | null
  gitBranch:         string | null
  gitLastCommit:     string | null
  phases:            Array<{ name: string; status: string; featureCount: number }>
  features:          Array<{ name: string; status: string; phase: string; type: string }>
  // Summaries: all context files, one paragraph each (~100 chars)
  contextSummaries:  Array<{ file_path: string; summary: string }>
  // Full content: only smart-loaded files for this turn
  contextFull:       Array<{ file_path: string; content: string }>
  // Workflow files always loaded in full (they are concise by design)
  workflowPhases:    string | null   // reminisce/workflow/phases.md content
  workflowFeatures:  string | null   // reminisce/workflow/features.md content
  currentDate:       string
  pastMemory:        Array<{ summary: string; created_at: string }>
}): string {
  // ── Phase + feature summary ──────────────────────────────────────────────
  const phasesSummary = ctx.phases.length > 0
    ? ctx.phases.map(p => {
        const done = ctx.features.filter(
          f => f.phase === p.name &&
               (f.status === 'done' || f.status === 'complete'),
        ).length
        const pct = p.featureCount > 0
          ? Math.round((done / p.featureCount) * 100)
          : 0
        return `  - ${p.name} [${p.status}] — ${done}/${p.featureCount} features (${pct}% done)`
      }).join('\n')
    : '  (no phases yet — run the Wizard to generate a blueprint)'

  const featuresSummary = ctx.features.length > 0
    ? ctx.features.map(f =>
        `  - ${f.name} [${f.status}] (${f.type}) → ${f.phase}`,
      ).join('\n')
    : '  (no features yet)'

  // ── Tiered context injection ─────────────────────────────────────────────
  // Tier 1: always inject — one-paragraph summaries for all context files
  const summaryBlock = ctx.contextSummaries.length > 0
    ? '## Context File Summaries (reference these files for detailed info)\n' +
      ctx.contextSummaries.map(c =>
        `### ${c.file_path}\n${c.summary}`
      ).join('\n\n')
    : ''

  // Tier 2: smart-loaded — full content for files relevant to this turn
  const fullBlock = ctx.contextFull.length > 0
    ? '## Loaded Context Files (full content for this turn)\n' +
      ctx.contextFull.map(c =>
        `### ${c.file_path}\n${c.content}`
      ).join('\n\n---\n\n')
    : ''

  // Tier 3: workflow files always in full (they are auto-generated and concise)
  const workflowBlock = [
    ctx.workflowPhases
      ? `### reminisce/workflow/phases.md\n${ctx.workflowPhases}`
      : null,
    ctx.workflowFeatures
      ? `### reminisce/workflow/features.md\n${ctx.workflowFeatures}`
      : null,
  ].filter(Boolean).join('\n\n')

  // ── Git state ────────────────────────────────────────────────────────────
  const gitBlock = (ctx.gitBranch || ctx.gitLastCommit)
    ? `Current branch: ${ctx.gitBranch ?? 'unknown'}\nLast commit: ${ctx.gitLastCommit ?? 'unknown'}`
    : ''

  // ── Past memory ──────────────────────────────────────────────────────────
  const memoryBlock = ctx.pastMemory.length > 0
    ? 'Memory from previous conversations:\n' +
      ctx.pastMemory.map((m, i) =>
        `[${i + 1}] ${new Date(m.created_at).toLocaleDateString()} — ${m.summary}`
      ).join('\n')
    : ''

  return `You are PAM — Project Action Manager — the embedded AI assistant inside Reminisce, a developer project management platform.

PAM's personality:
- Direct, precise, and useful. No padding, no filler.
- Speaks like a sharp senior colleague who knows the project inside out.
- Proactively spots issues and makes concrete suggestions.
- When uncertain, asks one focused clarifying question rather than guessing.

PAM's capabilities:
- Answer any question about the project using the full context below.
- Summarise progress, phases, and feature status.
- Suggest next steps, identify risks, and give architectural opinions.
- Generate development prompts on request (user can save them).
- Explain what any feature or phase involves.
- Give a full project status briefing on request.
- Users can prefix messages with /commands for fast actions:
    /status or /briefing       → full project status report
    /done @feature:[name]      → mark a feature as done (emit UPDATE_FEATURE_STATUS)
    /active @feature:[name]    → start a feature (emit UPDATE_FEATURE_STATUS)
    /block @feature:[name]     → mark a feature as blocked (emit UPDATE_FEATURE_STATUS)
    /prompt @feature:[name]    → generate a build prompt for that feature
    /add [feature] to @phase:[name] → add a new feature to a phase
    /remind [text] on [date]   → create a project reminder
- Users can @mention features or phases to scope their question.
  Example: "@feature:Auth Flow — what's the best approach for OAuth2?"

SCOPE AWARENESS:
You have access to product-scope.md (summary below, full content loaded when relevant).
If a user requests something that appears outside the defined v1 scope, warn them before proceeding:
"⚠️ Scope alert: [requested thing] wasn't in your original blueprint scope. Adding it may impact [affected phase]. Do you want to proceed or keep it noted for v2?"
Only raise this alert when you are confident the request contradicts the scope — do not over-trigger.

ACTIONS:
When PAM proposes to UPDATE something, it MUST emit a structured action signal at the END of its response:

[PAM_ACTION]
{"type":"UPDATE_FEATURE_STATUS","featureId":"<uuid>","featureName":"<name>","newStatus":"<status>"}
[/PAM_ACTION]

[PAM_ACTION]
{"type":"UPDATE_PHASE_STATUS","phaseId":"<uuid>","phaseName":"<name>","newStatus":"<status>"}
[/PAM_ACTION]

[PAM_ACTION]
{"type":"CREATE_PROMPT","featureName":"<name>","featureId":"<uuid or null>","promptText":"<full prompt>"}
[/PAM_ACTION]

[PAM_ACTION]
{"type":"ADD_FEATURE","phaseName":"<name>","phaseId":"<uuid>","featureName":"<new name>","featureType":"frontend","description":"<brief description>"}
[/PAM_ACTION]

[PAM_ACTION]
{"type":"CREATE_REMINDER","text":"<reminder text>","due_date":"<YYYY-MM-DD or null>"}
[/PAM_ACTION]

Valid status values: planned | todo | in_progress | review | blocked | done
Only emit [PAM_ACTION] when the user explicitly asks PAM to update something.
Never emit it speculatively. Always confirm the action in your text before emitting.

═══════════════════════════════════════
PROJECT: ${ctx.projectName}
DATE: ${ctx.currentDate}
${ctx.projectDesc ? `DESCRIPTION: ${ctx.projectDesc}` : ''}
${gitBlock ? `\nGIT:\n${gitBlock}` : ''}

PHASES:
${phasesSummary}

FEATURES:
${featuresSummary}
${workflowBlock ? `\nWORKFLOW:\n${workflowBlock}` : ''}
${summaryBlock ? `\n${summaryBlock}` : ''}
${fullBlock ? `\n${fullBlock}` : ''}
${memoryBlock ? `\n${memoryBlock}` : ''}
═══════════════════════════════════════

When answering, draw on the project context above. If the user asks about something
not covered by the context, say so clearly rather than guessing.`
}

// ─────────────────────────────────────────────────────────────────────────────
//  Action signal parser
// ─────────────────────────────────────────────────────────────────────────────

function extractAction(text: string): {
  cleanText: string
  actionType: string | null
  actionPayload: Record<string, unknown> | null
} {
  const match = text.match(/\[PAM_ACTION\]([\s\S]*?)\[\/PAM_ACTION\]/m)
  if (!match) return { cleanText: text.trim(), actionType: null, actionPayload: null }

  const jsonStr = match[1].trim()
  const cleanText = text.replace(/\[PAM_ACTION\][\s\S]*?\[\/PAM_ACTION\]/m, '').trim()

  try {
    const payload = JSON.parse(jsonStr) as Record<string, unknown>
    return {
      cleanText,
      actionType: (payload.type as string) ?? null,
      actionPayload: payload,
    }
  } catch {
    return { cleanText, actionType: null, actionPayload: null }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Changelog appender — writes to changes.md in contexts table
//  Non-fatal: if this fails the action still completes
// ─────────────────────────────────────────────────────────────────────────────

async function appendToChangelog(
  supabase: ReturnType<typeof getServiceSupabase>,
  projectId: string,
  entry: string,
): Promise<void> {
  try {
    const { data: existing } = await supabase
      .from('contexts')
      .select('content')
      .eq('project_id', projectId)
      .eq('file_path', 'reminisce/logs/changes.md')
      .single()

    const currentContent = existing?.content ??
      '# Project Changes Log\n\nAutomatically appended by Reminisce when PAM makes project changes.\n\n'

    const updated = currentContent + entry

    await supabase.from('contexts').upsert(
      {
        project_id:    projectId,
        file_path:     'reminisce/logs/changes.md',
        content:       updated,
        owned_by:      'developer',
        last_modified: new Date().toISOString(),
      },
      { onConflict: 'project_id,file_path' },
    )
  } catch (err) {
    console.error('[PAM] changelog append failed:', err)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/pam/message
//  Sends a user message, streams PAM response, saves both to DB.
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } =
      await clientSupabase.auth.getUser(token)
    if (!user || authError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Check if user is banned
    const { isUserBanned } = await import('@/lib/supabase')
    if (await isUserBanned(user.id))
      return NextResponse.json({ error: 'Account suspended' }, { status: 403 })

    const { threadId, projectId, provider, model, content } = await req.json()

    if (!threadId || !projectId || !provider || !model || !content?.trim())
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })

    if (!await verifyProjectAccess(user.id, projectId))
      return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await ensureWallet(user.id)

    const supabase = getServiceSupabase()

    // ── Thread ownership check ────────────────────────────────────────────
    // Verify the thread belongs to this user AND this project
    const { data: threadRow, error: threadErr } = await supabase
      .from('pam_threads')
      .select('id, user_id, project_id')
      .eq('id', threadId)
      .single()

    if (threadErr || !threadRow) {
      return NextResponse.json(
        { error: 'Thread not found' },
        { status: 404 }
      )
    }

    if (threadRow.user_id !== user.id || threadRow.project_id !== projectId) {
      return NextResponse.json(
        { error: 'Forbidden: thread does not belong to you' },
        { status: 403 }
      )
    }

    // ── BYOK check ───────────────────────────────────────────────────────
    const isBYOK = await userHasOwnKey(user.id, provider as AIProvider)
    let runId: string | null = null

    if (!isBYOK) {
      const costResult = await deductCost(user.id, model)
      if (!costResult.success)
        return NextResponse.json({ error: costResult.message }, { status: 402 })
    }

    // ── Detect which files to smart-load for this turn ──────────────────────
    const smartLoadPaths = detectSmartLoadPaths(content)

    // ── Load all context in parallel ────────────────────────────────────────
    const [
      { data: project },
      { data: phases },
      { data: features },
      { data: allContextRows },
      { data: previousMessages },
      { data: pastSummaries },
    ] = await Promise.all([
      // Now also loads git_branch and git_last_commit (Phase 1 columns)
      supabase
        .from('projects')
        .select('name, description, git_branch, git_last_commit')
        .eq('id', projectId)
        .single(),
      supabase
        .from('phases')
        .select('id, name, status, order_index')
        .eq('project_id', projectId)
        .order('order_index'),
      supabase
        .from('features')
        .select('id, name, status, type, phase_id, phases(name)')
        .eq('project_id', projectId)
        .order('priority'),
      // Load summary + content for all context files
      // summary for all, full content only for smart-loaded files
      supabase
        .from('contexts')
        .select('file_path, summary, content')
        .eq('project_id', projectId),
      supabase
        .from('pam_messages')
        .select('role, content')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true })
        .limit(40),
      supabase
        .from('pam_thread_summaries')
        .select('summary, created_at')
        .eq('project_id', projectId)
        .neq('thread_id', threadId)
        .order('created_at', { ascending: false })
        .limit(4),
    ])

    // ── Save user message ───────────────────────────────────────────────────
    const { data: userMsg } = await supabase
      .from('pam_messages')
      .insert({
        thread_id:  threadId,
        project_id: projectId,
        role:       'user',
        content:    content.trim(),
      })
      .select('id')
      .single()

    runId = userMsg?.id ?? null

    // ── Build tiered context ────────────────────────────────────────────────
    const allRows = allContextRows ?? []

    // Summaries: all files that have a summary — injected every turn
    const contextSummaries = allRows
      .filter(r =>
        r.summary &&
        r.summary.trim().length > 0 &&
        !r.file_path.includes('/workflow/') &&
        !r.file_path.includes('/logs/'),
      )
      .map(r => ({ file_path: r.file_path, summary: r.summary! }))

    // Full content: only smart-loaded files this turn
    const contextFull = allRows
      .filter(r =>
        smartLoadPaths.includes(r.file_path) &&
        r.content &&
        r.content.trim().length > 0,
      )
      .map(r => ({ file_path: r.file_path, content: r.content! }))

    // Workflow files: always inject in full (they are short by design)
    const workflowPhases = allRows
      .find(r => r.file_path === 'reminisce/workflow/phases.md')?.content ?? null
    const workflowFeatures = allRows
      .find(r => r.file_path === 'reminisce/workflow/features.md')?.content ?? null

    // ── Build phase context with feature counts ─────────────────────────────
    const phasesWithCount = (phases ?? []).map(p => ({
      name:         p.name,
      status:       p.status ?? 'planned',
      featureCount: (features ?? []).filter(f => f.phase_id === p.id).length,
    }))

    const flatFeatures = (features ?? []).map(f => ({
      id:     f.id,
      name:   f.name,
      status: f.status ?? 'planned',
      type:   f.type ?? 'frontend',
      phase:  (
        Array.isArray(f.phases)
          ? (f.phases[0] as { name: string })?.name
          : (f.phases as unknown as { name: string })?.name
      ) ?? 'Unknown',
    }))

    // ── Build system prompt ─────────────────────────────────────────────────
    const systemPrompt = buildSystemPrompt({
      projectName:      project?.name ?? 'Unknown Project',
      projectDesc:      project?.description ?? null,
      gitBranch:        (project as { git_branch?: string | null } | null)?.git_branch ?? null,
      gitLastCommit:    (project as { git_last_commit?: string | null } | null)?.git_last_commit ?? null,
      phases:           phasesWithCount,
      features:         flatFeatures,
      contextSummaries,
      contextFull,
      workflowPhases,
      workflowFeatures,
      currentDate: new Date().toLocaleDateString('en-GB', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      }),
      pastMemory: (pastSummaries ?? []).map(s => ({
        summary:    s.summary,
        created_at: s.created_at,
      })),
    })

    // ── Build message array ─────────────────────────────────────────────────
    const history = (previousMessages ?? []).map(m => ({
      role:    m.role as 'user' | 'assistant',
      content: m.content,
    }))

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...history,
      { role: 'user' as const, content: content.trim() },
    ]

    // ── Call AI ─────────────────────────────────────────────────────────────
    let aiRes: Response
    try {
      aiRes = await callAI({
        userId:   user.id,
        provider: provider as AIProvider,
        model,
        stream:   true,
        messages,
      }) as Response
    } catch (aiErr) {
      if (!isBYOK) await refundCost(user.id, model, runId ?? undefined)
      throw aiErr
    }

    const decoder = new TextDecoder()

    const stream = new ReadableStream({
      async start(controller) {
        let fullText = ''
        const reader = aiRes.body?.getReader()
        if (!reader) { controller.close(); return }

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            const chunk = decoder.decode(value, { stream: true })
            controller.enqueue(value)

            for (const line of chunk.split('\n')) {
              if (!line.startsWith('data: ')) continue
              const data = line.slice(6)
              if (data === '[DONE]') continue
              try {
                const parsed = JSON.parse(data)
                fullText += parsed.choices?.[0]?.delta?.content ?? ''
              } catch { /* partial chunk */ }
            }
          }

          // ── Parse action signal ─────────────────────────────────────────
          const { cleanText, actionType, actionPayload } = extractAction(fullText)

          // ── Save assistant message ──────────────────────────────────────
          await supabase.from('pam_messages').insert({
            thread_id:        threadId,
            project_id:       projectId,
            role:             'assistant',
            content:          cleanText,
            model_used:       `${provider}/${model}`,
            tokens_used:      Math.floor(fullText.length / 4),
            action_type:      actionType,
            action_payload:   actionPayload,
            action_confirmed: actionType ? null : undefined,
          })

          // ── Update thread metadata ──────────────────────────────────────
          await supabase.from('pam_threads').update({
            model_used:      `${provider}/${model}`,
            provider_used:   provider,
            last_message_at: new Date().toISOString(),
          }).eq('id', threadId)

          // ── Send meta event to client ───────────────────────────────────
          const hasDrift = fullText.includes('⚠️ Scope alert:')
          controller.enqueue(
            new TextEncoder().encode(
              `data: ${JSON.stringify({
                __pam_meta: true,
                scopeDrift: hasDrift,
              })}\n\n`,
            ),
          )

          if (actionType && actionPayload) {
            controller.enqueue(
              new TextEncoder().encode(
                `data: ${JSON.stringify({ __pam_action: true, actionType, actionPayload })}\n\n`,
              ),
            )
          }

          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'))
        } catch (err) {
          console.error('PAM stream error:', err)
          if (!isBYOK) await refundCost(user.id, model, runId ?? undefined)
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type':  'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection':    'keep-alive',
      },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('PAM message error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  PATCH /api/pam/message
//  Confirms or rejects a pending PAM action.
//  On confirm: executes DB write + appends to changes.md changelog.
// ─────────────────────────────────────────────────────────────────────────────

export async function PATCH(req: Request) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } =
      await clientSupabase.auth.getUser(token)
    if (!user || authError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { messageId, confirmed } = await req.json()
    if (!messageId || typeof confirmed !== 'boolean')
      return NextResponse.json({ error: 'Missing messageId or confirmed' }, { status: 400 })

    const supabase = getServiceSupabase()

    const { data: msg } = await supabase
      .from('pam_messages')
      .select('action_type, action_payload, project_id')
      .eq('id', messageId)
      .single()

    if (!msg || !await verifyProjectAccess(user.id, msg.project_id))
      return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await supabase.from('pam_messages')
      .update({ action_confirmed: confirmed })
      .eq('id', messageId)

    if (!confirmed)
      return NextResponse.json({ ok: true, executed: false })

    const payload    = msg.action_payload as Record<string, unknown>
    const projectId  = msg.project_id as string
    const now        = new Date()
    const dateStr    = now.toISOString().slice(0, 16).replace('T', ' ')

    // Load git_branch for changelog entries
    const { data: proj } = await supabase
      .from('projects')
      .select('git_branch')
      .eq('id', projectId)
      .single()
    const branch = (proj as { git_branch?: string | null } | null)?.git_branch ?? null

    let changelogEntry = ''

    switch (msg.action_type) {
      case 'UPDATE_FEATURE_STATUS': {
        const { featureId, newStatus, featureName } = payload
        await supabase.from('features')
          .update({ status: newStatus as string })
          .eq('id', featureId as string)
          .eq('project_id', projectId)
        changelogEntry = `\n## ${dateStr} — Feature Status Update${branch ? ` (${branch})` : ''}\n**Action:** UPDATE_FEATURE_STATUS\n**Feature:** ${featureName} → \`${newStatus}\`\n---\n`
        break
      }
      case 'UPDATE_PHASE_STATUS': {
        const { phaseId, newStatus, phaseName } = payload
        await supabase.from('phases')
          .update({ status: newStatus as string })
          .eq('id', phaseId as string)
          .eq('project_id', projectId)
        changelogEntry = `\n## ${dateStr} — Phase Status Update${branch ? ` (${branch})` : ''}\n**Action:** UPDATE_PHASE_STATUS\n**Phase:** ${phaseName} → \`${newStatus}\`\n---\n`
        break
      }
      case 'CREATE_PROMPT': {
        const { featureId, promptText, featureName } = payload
        await supabase.from('prompts').insert({
          project_id:        projectId,
          feature_id:        featureId ?? null,
          raw_prompt:        promptText as string,
          structured_prompt: promptText as string,
          prompt_type:       'PAM_GENERATED',
          title:             `PAM: ${featureName ?? 'Generated prompt'}`,
        })
        changelogEntry = `\n## ${dateStr} — Prompt Created${branch ? ` (${branch})` : ''}\n**Action:** CREATE_PROMPT\n**Feature:** ${featureName}\n---\n`
        break
      }
      case 'ADD_FEATURE': {
        const { phaseId, featureName, featureType, description } = payload
        const { data: phase } = await supabase
          .from('phases')
          .select('id')
          .eq('id', phaseId as string)
          .eq('project_id', projectId)
          .single()
        if (phase) {
          await supabase.from('features').insert({
            project_id:  projectId,
            phase_id:    phaseId as string,
            name:        featureName as string,
            type:        (featureType as string) ?? 'frontend',
            description: (description as string) ?? null,
            status:      'planned',
            priority:    0,
          })
        }
        changelogEntry = `\n## ${dateStr} — Feature Added${branch ? ` (${branch})` : ''}\n**Action:** ADD_FEATURE\n**Feature:** ${featureName} (${featureType}) added to phase ${(payload.phaseName as string) ?? ''}\n---\n`
        break
      }
      case 'CREATE_REMINDER': {
        const { text, due_date } = payload
        await supabase.from('project_reminders').insert({
          project_id: projectId,
          user_id:    user.id,
          text:       (text as string).trim(),
          due_date:   (due_date as string) ?? null,
        })
        // Reminders don't go in changelog — they're ephemeral
        break
      }
    }

    // Append to changes.md — non-fatal
    if (changelogEntry) {
      await appendToChangelog(supabase, projectId, changelogEntry)
    }

    // ── Sync feature status to DB as fallback (in case featureId was missing/wrong) ──
    if (confirmed && msg.action_type === 'UPDATE_FEATURE_STATUS' && payload?.featureName) {
      const { newStatus, featureName } = payload
      const { data: matchedFeature } = await supabase
        .from('features')
        .select('id')
        .eq('project_id', projectId)
        .ilike('name', (featureName as string).trim())
        .limit(1)
        .maybeSingle()

      if (matchedFeature?.id) {
        await supabase
          .from('features')
          .update({ status: newStatus as string })
          .eq('id', matchedFeature.id)
      }
    }

    return NextResponse.json({ ok: true, executed: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
