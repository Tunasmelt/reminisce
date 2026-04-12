import { NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/admin-auth'
import { getServiceSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const check = await verifyAdmin(req.headers.get('authorization'))
  if (!check.ok) return check.response

  const { searchParams } = new URL(req.url)
  const page  = Math.max(1, parseInt(searchParams.get('page')  || '1'))
  const limit = Math.max(1, parseInt(searchParams.get('limit') || '50'))
  const search = searchParams.get('search') || ''
  const from = (page - 1) * limit

  const sb = getServiceSupabase()

  let query = sb
    .from('user_plans')
    .select(`
      user_id, plan, status, projects_limit,
      is_admin, banned_at, ban_reason, notes,
      stripe_customer_id, stripe_subscription_id,
      created_at, updated_at
    `, { count: 'exact' })

  if (search && search.includes('@')) {
    // Search auth users by email first
    const { data: authSearch } = await sb.auth.admin.listUsers()
    const matchedIds = (authSearch?.users ?? [])
      .filter(u => u.email?.toLowerCase().includes(search.toLowerCase()))
      .map(u => u.id)
    if (matchedIds.length > 0) {
      query = query.in('user_id', matchedIds)
    } else {
      // No matches — return empty
      return NextResponse.json({ users: [], total: 0, page, limit })
    }
  } else if (search) {
    if (search.length > 20) {
      query = query.eq('user_id', search)
    } else {
      query = query.ilike('notes', `%${search}%`)
    }
  }

  query = query
    .range(from, from + limit - 1)
    .order('created_at', { ascending: false })

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fetch wallet data for each user
  const userIds = (data || []).map(u => u.user_id)
  const { data: wallets } = await sb
    .from('user_wallets')
    .select('user_id, gems, coins')
    .in('user_id', userIds)

  const walletMap = Object.fromEntries(
    (wallets || []).map(w => [w.user_id, w])
  )

  // Fetch emails only for the actual user IDs we have
  // This is more efficient than paginating auth users separately
  const emailMap: Record<string, string> = {}
  const lastSignInMap: Record<string, string | null> = {}

  if (userIds.length > 0) {
    // listUsers doesn't support filtering by ID, so fetch all and filter
    // For small user counts (< 1000) this is fine
    let page_ = 1
    let done = false
    while (!done) {
      const { data: authBatch } = await sb.auth.admin.listUsers({
        perPage: 100,
        page: page_,
      })
      if (!authBatch?.users || authBatch.users.length === 0) {
        done = true
        break
      }
      authBatch.users.forEach(u => {
        if (userIds.includes(u.id)) {
          emailMap[u.id] = u.email ?? 'no-email'
          lastSignInMap[u.id] = u.last_sign_in_at ?? null
        }
      })
      // If we've found all users, stop early
      if (Object.keys(emailMap).length >= userIds.length) done = true
      page_++
      if (page_ > 20) done = true // safety limit (max 2000 users)
    }
  }

  // Fetch project counts — join through workspaces to get owner_id
  const { data: pData } = await sb
    .from('projects')
    .select('id, workspaces!inner(owner_id)')

  const pCounts: Record<string, number> = {}
  if (pData) {
    (pData as unknown as Array<{ workspaces: { owner_id: string } }>).forEach((p) => {
      const oid = p.workspaces?.owner_id
      if (oid) pCounts[oid] = (pCounts[oid] || 0) + 1
    })
  }

  const users = (data || []).map(u => ({
    ...u,
    id: u.user_id,
    email: emailMap[u.user_id] ?? u.user_id,
    coins: walletMap[u.user_id]?.coins ?? 0,
    gems: walletMap[u.user_id]?.gems ?? 0,
    project_count: pCounts[u.user_id] ?? 0,
    last_sign_in: lastSignInMap[u.user_id] ?? u.updated_at,
  }))

  return NextResponse.json({ users, total: count ?? 0, page, limit })
}
