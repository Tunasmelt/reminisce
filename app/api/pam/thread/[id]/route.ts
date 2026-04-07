import { NextResponse } from 'next/server'
import { getServiceSupabase, supabase as clientSupabase } from '@/lib/supabase'

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

    const body = await req.json()
    const supabase = getServiceSupabase()

    const updateFields: Record<string, unknown> = {}
    if (typeof body.title    === 'string')  updateFields.title    = body.title
    if (typeof body.archived === 'boolean') updateFields.archived = body.archived

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
