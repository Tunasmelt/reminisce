import { NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/admin-auth'
import { getServiceSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const check = await verifyAdmin(req.headers.get('authorization'))
  if (!check.ok) return check.response

  const body = await req.json()
  const sb = getServiceSupabase()

  const allowed = ['label', 'enabled', 'is_free', 'tier_required', 'sort_order', 'notes', 'model_name']
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields' }, { status: 400 })
  }

  if ('is_free' in updates) {
    updates.tier_required = updates.is_free ? 'free' : 'pro'
  }

  const { data, error } = await sb
    .from('provider_models')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await sb.from('admin_logs').insert({
    admin_id:    check.userId,
    action:      'update_model',
    target_id:   params.id,
    target_type: 'model',
    payload:     { model_id: params.id, updates },
    details:     { model_id: params.id, updates },
  })

  return NextResponse.json({ model: data })
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const check = await verifyAdmin(req.headers.get('authorization'))
  if (!check.ok) return check.response

  const sb = getServiceSupabase()
  const { error } = await sb
    .from('provider_models')
    .delete()
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await sb.from('admin_logs').insert({
    admin_id:    check.userId,
    action:      'delete_model',
    target_id:   params.id,
    target_type: 'model',
    payload:     { model_id: params.id },
    details:     { model_id: params.id },
  })

  return NextResponse.json({ ok: true })
}
