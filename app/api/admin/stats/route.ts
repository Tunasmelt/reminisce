import { NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/admin-auth'
import { getServiceSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const check = await verifyAdmin(req.headers.get('authorization'))
  if (!check.ok) return check.response

  const sb = getServiceSupabase()

  const today = new Date()
  today.setHours(0,0,0,0)
  const todayStr = today.toISOString()

  // 1. Users
  const [
    { count: totalUsers,    error: e1 },
    { count: proUsers,      error: e2 },
    { count: bannedUsers,   error: e3 },
    { count: newUsersToday, error: e4 }
  ] = await Promise.all([
    sb.from('user_plans').select('*', { count: 'exact', head: true }),
    sb.from('user_plans').select('*', { count: 'exact', head: true }).eq('plan', 'pro'),
    sb.from('user_plans').select('*', { count: 'exact', head: true }).not('banned_at', 'is', null),
    sb.from('user_plans').select('*', { count: 'exact', head: true }).gte('created_at', todayStr)
  ])
  if (e1 || e2 || e3 || e4) console.error('[Stats] User query error:', { e1, e2, e3, e4 })

  // 2. Projects
  const [
    { count: totalProjects,  error: e5 },
    { count: activeProjects, error: e6 }
  ] = await Promise.all([
    sb.from('projects').select('*', { count: 'exact', head: true }),
    sb.from('projects').select('*', { count: 'exact', head: true }).gte('created_at', todayStr)
  ])
  if (e5 || e6) console.error('[Stats] Project query error:', { e5, e6 })

  // 3. Activity
  const [
    { count: agentRuns,      error: e7 },
    { count: pamMessages,    error: e8 },
    { count: wizardSessions, error: e9 }
  ] = await Promise.all([
    sb.from('agent_runs').select('*', { count: 'exact', head: true }).gte('created_at', todayStr),
    sb.from('pam_messages').select('*', { count: 'exact', head: true }).gte('created_at', todayStr),
    sb.from('wizard_sessions').select('*', { count: 'exact', head: true }).gte('created_at', todayStr)
  ])
  if (e7 || e8 || e9) console.error('[Stats] Activity query error:', { e7, e8, e9 })

  // 4. Economy
  const { data: walletSums, error: e10 } = await sb.from('user_wallets').select('coins, gems')
  if (e10) console.error('[Stats] Wallet query error:', e10)
  const totalCoins = (walletSums || []).reduce((acc, w) => acc + (w.coins || 0), 0)
  const totalGems = (walletSums || []).reduce((acc, w) => acc + (w.gems || 0), 0)

  // Recent signups
  const { data: recentSignupRows, error: e11 } = await sb
    .from('user_plans')
    .select('user_id, plan, created_at')
    .order('created_at', { ascending: false })
    .limit(10)
  if (e11) console.error('[Stats] Signup query error:', e11)

  // Recent transactions
  const { data: recentTxRows, error: e12 } = await sb
    .from('wallet_transactions')
    .select('type, amount, currency, description, created_at, transaction_source')
    .order('created_at', { ascending: false })
    .limit(15)
  if (e12) console.error('[Stats] Tx query error:', e12)

  // Transactions today count
  const { count: txToday, error: e13 } = await sb
    .from('wallet_transactions')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', todayStr)
  if (e13) console.error('[Stats] Tx count error:', e13)

  return NextResponse.json({
    users: {
      total: totalUsers ?? 0,
      pro: proUsers ?? 0,
      free: Math.max(0, (totalUsers ?? 0) - (proUsers ?? 0)),
      banned: bannedUsers ?? 0,
      newToday: newUsersToday ?? 0
    },
    projects: {
      total: totalProjects ?? 0,
      active: activeProjects ?? 0
    },
    economy: {
      totalCoins,
      totalGems,
      transactionsToday: txToday ?? 0
    },
    activity: {
      agentRunsToday: agentRuns ?? 0,
      pamMessagesToday: pamMessages ?? 0,
      wizardSessionsToday: wizardSessions ?? 0
    },
    recentSignups: recentSignupRows ?? [],
    recentTransactions: recentTxRows ?? []
  })
}
