import { getServiceSupabase } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function verifyAdmin(
  authHeader: string | null
): Promise<
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse }
> {
  if (!authHeader) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  const { supabase: clientSupabase } = await import('@/lib/supabase')
  const token = authHeader.replace('Bearer ', '')

  const { data: { user }, error } =
    await clientSupabase.auth.getUser(token)

  if (!user || error) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  const sb = getServiceSupabase()
  const { data: plan } = await sb
    .from('user_plans')
    .select('is_admin')
    .eq('user_id', user.id)
    .single()

  if (!plan?.is_admin) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden: admin only' }, { status: 403 }),
    }
  }

  return { ok: true, userId: user.id }
}
