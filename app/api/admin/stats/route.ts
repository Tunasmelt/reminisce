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
    { count: totalUsers    },
    { count: proUsers      },
    { count: bannedUsers   },
    { count: newUsersToday }
  ] = await Promise.all([
    sb.from('user_plans').select('*', { count: 'exact', head: true }),
    sb.from('user_plans').select('*', { count: 'exact', head: true }).eq('plan', 'pro'),
    sb.from('user_plans').select('*', { count: 'exact', head: true }).not('banned_at', 'is', null),
    sb.from('user_plans').select('*', { count: 'exact', head: true }).gte('created_at', todayStr)
  ])

  // 2. Projects
  const [
    { count: totalProjects },
    { count: activeProjects }
  ] = await Promise.all([
    sb.from('projects').select('*', { count: 'exact', head: true }),
    sb.from('projects').select('*', { count: 'exact', head: true }).gte('created_at', todayStr) // active = new today for simple metric
  ])

  // 3. Activity
  const [
    { count: agentRuns },
    { count: pamMessages },
    { count: wizardSessions }
  ] = await Promise.all([
    sb.from('agent_runs').select('*', { count: 'exact', head: true }).gte('created_at', todayStr),
    sb.from('pam_messages').select('*', { count: 'exact', head: true }).gte('created_at', todayStr),
    sb.from('wizard_sessions').select('*', { count: 'exact', head: true }).gte('created_at', todayStr)
  ])

  // 4. Economy
  const { data: walletSums } = await sb.from('user_wallets').select('coins, gems')
  const totalCoins = (walletSums || []).reduce((acc, w) => acc + (w.coins || 0), 0)
  const totalGems = (walletSums || []).reduce((acc, w) => acc + (w.gems || 0), 0)

  // Recent signups (last 10 new user_plans rows)
  const { data: recentSignupRows } = await sb
    .from('user_plans')
    .select('user_id, plan, created_at')
    .order('created_at', { ascending: false })
    .limit(10)

  // Recent transactions (last 15 wallet transactions)
  const { data: recentTxRows } = await sb
    .from('wallet_transactions')
    .select('type, amount, currency, description, created_at, transaction_source')
    .order('created_at', { ascending: false })
    .limit(15)

  // Transactions today count (not 0)
  const { count: txToday } = await sb
    .from('wallet_transactions')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', todayStr)

  return NextResponse.json({
    users: {
      total: totalUsers ?? 0,
      pro: proUsers ?? 0,
      free: (totalUsers ?? 0) - (proUsers ?? 0),
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
