import { NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/admin-auth'
import { getServiceSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const check = await verifyAdmin(req.headers.get('authorization'))
  if (!check.ok) return check.response

  const sb = getServiceSupabase()
  const { data, error } = await sb
    .from('provider_models')
    .select('*')
    .order('sort_order', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ models: data })
}

export async function POST(req: Request) {
  const check = await verifyAdmin(req.headers.get('authorization'))
  if (!check.ok) return check.response

  const body = await req.json()
  const { provider, model_id, model_name, label, is_free, enabled, tier_required, sort_order } = body

  if (!provider || !model_id || !model_name) {
    return NextResponse.json({ error: 'provider, model_id, model_name required' }, { status: 400 })
  }

  const sb = getServiceSupabase()
  const { data, error } = await sb
    .from('provider_models')
    .insert({
      provider,
      model_id,
      model_name,
      label: label || model_name,
      is_free: is_free ?? true,
      enabled: enabled ?? true,
      tier_required: tier_required || (is_free ? 'free' : 'pro'),
      sort_order: sort_order ?? 99,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await getServiceSupabase().from('admin_logs').insert({
    admin_id:    check.userId,
    action:      'create_model',
    target_id:   model_id,
    target_type: 'model',
    payload:     { model_id, provider },
    details:     { model_id, provider },
  })

  return NextResponse.json({ model: data })
}
