import { NextResponse } from 'next/server'
import { getServiceSupabase, supabase as clientSupabase, verifyProjectAccess } from '@/lib/supabase'
import { callAI } from '@/lib/ai-client'
import type { AIProvider } from '@/lib/ai-client'

// POST /api/pam/summarise
// Summarises a completed thread and stores the summary for
// cross-thread memory. Called when a thread is archived or
// when the user starts a new thread (background, non-blocking).
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

    const { threadId, provider = 'groq', model = 'llama-3.1-8b-instant' } = await req.json()
    if (!threadId)
      return NextResponse.json({ error: 'Missing threadId' }, { status: 400 })

    const supabase = getServiceSupabase()

    // Load thread messages
    const { data: messages } = await supabase
      .from('pam_messages')
      .select('role, content, created_at')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true })

    if (!messages || messages.length < 2)
      return NextResponse.json({ ok: true, skipped: true })

    // Load thread + project info
    const { data: thread } = await supabase
      .from('pam_threads')
      .select('project_id, title, message_count')
      .eq('id', threadId)
      .single()

    if (!thread) return NextResponse.json({ error: 'Thread not found' }, { status: 404 })

    if (!await verifyProjectAccess(user.id, thread.project_id))
      return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Build compact transcript for summarisation
    const transcript = messages
      .filter(m => m.role !== 'system')
      .map(m => `${m.role === 'user' ? 'User' : 'PAM'}: ${m.content.slice(0, 400)}`)
      .join('\n')
      .slice(0, 4000) // keep well within context window

    const summaryPrompt = `You are summarising a conversation between a developer and PAM (Project Action Manager).
    
Conversation title: "${thread.title ?? 'Untitled'}"

TRANSCRIPT:
${transcript}

Write a concise summary (3-5 sentences max) covering:
1. What the user was working on or asking about
2. Any decisions made or actions confirmed
3. Key information that would be useful in a future conversation

Be specific. Include feature names, phase names, or technical details mentioned.
Do NOT add padding or generic statements.`

    const aiRes = await callAI({
      userId:   user.id,
      provider: provider as AIProvider,
      model,
      stream:   false,
      messages: [
        { role: 'system', content: 'You summarise developer project conversations concisely and accurately.' },
        { role: 'user',   content: summaryPrompt },
      ],
    }) as { choices: Array<{ message: { content: string } }> }

    const summary = aiRes.choices?.[0]?.message?.content?.trim() ?? ''
    if (!summary) return NextResponse.json({ ok: true, skipped: true })

    // Store summary
    await supabase.from('pam_thread_summaries').insert({
      thread_id:     threadId,
      project_id:    thread.project_id,
      summary,
      message_count: thread.message_count ?? messages.length,
    })

    // Mark thread as summarised
    await supabase.from('pam_threads')
      .update({ summarised: true })
      .eq('id', threadId)

    return NextResponse.json({ ok: true, summary })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
