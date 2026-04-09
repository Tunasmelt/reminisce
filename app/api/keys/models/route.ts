import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('provider_models')
      .select('provider, model_id, label, model_name, is_free, enabled, sort_order')
      .eq('enabled', true)
      .order('is_free', { ascending: false })
      .order('sort_order', { ascending: true })

    if (error) throw error

    const models = (data ?? []).map(m => ({
      provider: m.provider,
      model:    m.model_id,
      label:    m.label || m.model_name,
      free:     m.is_free,
    }))

    return NextResponse.json({ models })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
