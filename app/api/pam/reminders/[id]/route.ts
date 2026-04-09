import { NextResponse } from 'next/server'
import { getServiceSupabase, supabase as clientSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// PATCH /api/pam/reminders/[id]
// Marks a reminder as done or updates its text/due_date.
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

    // Verify ownership
    const { data: existing } = await supabase
      .from('project_reminders')
      .select('user_id')
      .eq('id', params.id)
      .single()

    if (!existing || existing.user_id !== user.id)
      return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const updateFields: Record<string, unknown> = {}
    if (typeof body.done     === 'boolean') updateFields.done     = body.done
    if (typeof body.text     === 'string')  updateFields.text     = body.text
    if ('due_date' in body)                 updateFields.due_date = body.due_date

    const { error } = await supabase
      .from('project_reminders')
      .update(updateFields)
      .eq('id', params.id)
      .eq('user_id', user.id)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// DELETE /api/pam/reminders/[id]
export async function DELETE(
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
    const { error } = await supabase
      .from('project_reminders')
      .delete()
      .eq('id', params.id)
      .eq('user_id', user.id)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
