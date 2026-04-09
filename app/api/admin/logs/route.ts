import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase'
import { verifyAdmin } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

// GET /api/admin/logs — list recent audit logs
export async function GET(req: Request) {
  const auth = await verifyAdmin(req.headers.get('authorization'))
  if (!auth.ok) return auth.response

  const sb = getServiceSupabase()
  const { data, error } = await sb
    .from('admin_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  const users = (data || []).map(log => ({
    ...log,
    target_id:   log.target_id ?? log.target_user,
    target_type: log.target_type ?? 'user',
    payload:     log.payload ?? log.details ?? {},
  }))

  return NextResponse.json({ logs: users })
}
