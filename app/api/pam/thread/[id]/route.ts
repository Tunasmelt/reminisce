import { NextResponse } from 'next/server'
import { getServiceSupabase, supabase as clientSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// ── Shared ownership check ────────────────────────────────────────────────────
async function verifyThreadOwnership(
  threadId: string,
  userId: string,
  supabase: ReturnType<typeof getServiceSupabase>
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  const { data: thread, error } = await supabase
    .from('pam_threads')
    .select('id, user_id')
    .eq('id', threadId)
    .single()

  if (error || !thread) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Thread not found' }, { status: 404 }),
    }
  }

  if (thread.user_id !== userId) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }

  return { ok: true }
}

// GET /api/pam/thread/[id]
// Returns all messages in a thread in ascending order.
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } =
      await clientSupabase.auth.getUser(token)
    if (!user || authError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = getServiceSupabase()

    // ── Ownership check ────────────────────────────────────────────────────
    const check = await verifyThreadOwnership(params.id, user.id, supabase)
    if (!check.ok) return check.response

    const { data: messages, error } = await supabase
      .from('pam_messages')
      .select('id, role, content, model_used, tokens_used, action_type, action_payload, action_confirmed, created_at')
      .eq('thread_id', params.id)
      .order('created_at', { ascending: true })

    if (error) throw error
    return NextResponse.json({ messages })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// PATCH /api/pam/thread/[id]
// Updates thread title (user rename) or archives it.
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } =
      await clientSupabase.auth.getUser(token)
    if (!user || authError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = getServiceSupabase()

    // ── Ownership check ────────────────────────────────────────────────────
    const check = await verifyThreadOwnership(params.id, user.id, supabase)
    if (!check.ok) return check.response

    const body = await req.json()
    const updateFields: Record<string, unknown> = {}
    if (typeof body.title    === 'string')  updateFields.title    = body.title
    if (typeof body.archived === 'boolean') updateFields.archived = body.archived

    if (Object.keys(updateFields).length === 0)
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })

    const { error } = await supabase
      .from('pam_threads')
      .update(updateFields)
      .eq('id', params.id)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
