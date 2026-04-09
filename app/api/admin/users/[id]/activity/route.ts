import { NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/admin-auth'
import { getServiceSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const check = await verifyAdmin(req.headers.get('authorization'))
  if (!check.ok) return check.response

  const sb = getServiceSupabase()
  const userId = params.id

  const { data: transactions } = await sb
    .from('wallet_transactions')
    .select('type, amount, currency, description, transaction_source, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20)

  return NextResponse.json({
    transactions: transactions ?? [],
    agentRuns: [],
  })
}
