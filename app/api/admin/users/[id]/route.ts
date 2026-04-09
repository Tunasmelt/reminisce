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
  const targetUserId = params.id

  // Actions: upgrade, downgrade, ban, unban, add_coins, add_gems, set_notes
  const { action, value } = body

  if (!action) return NextResponse.json({ error: 'action required' }, { status: 400 })

  try {
    let updateError = null

    switch (action) {
      case 'upgrade_pro': {
        const { error: err1 } = await sb.from('user_plans').update({
          plan: 'pro',
          status: 'active',
          projects_limit: 999,
          updated_at: new Date().toISOString(),
        }).eq('user_id', targetUserId)
        
        const { error: err2 } = await sb.from('user_wallets').update({
          daily_coins_limit: 200,
          max_coins_banked: 500,
          gems_monthly_grant: 100,
          updated_at: new Date().toISOString(),
        }).eq('user_id', targetUserId)
        
        updateError = err1 || err2
        break
      }
      case 'downgrade_free': {
        const { error: err1 } = await sb.from('user_plans').update({
          plan: 'free',
          status: 'active',
          projects_limit: 2,
          stripe_subscription_id: null,
          updated_at: new Date().toISOString(),
        }).eq('user_id', targetUserId)
        
        const { error: err2 } = await sb.from('user_wallets').update({
          daily_coins_limit: 50,
          max_coins_banked: 200,
          gems_monthly_grant: 0,
          updated_at: new Date().toISOString(),
        }).eq('user_id', targetUserId)
        
        updateError = err1 || err2
        break
      }
      case 'add_coins': {
        const amount = parseInt(value) || 0
        if (amount <= 0 || amount > 10000) {
          return NextResponse.json({ error: 'amount must be 1–10000' }, { status: 400 })
        }
        const { data: wallet } = await sb.from('user_wallets')
          .select('coins').eq('user_id', targetUserId).single()
        const newCoins = (wallet?.coins || 0) + amount
        const { error: err } = await sb.from('user_wallets').update({
          coins: newCoins,
          updated_at: new Date().toISOString(),
        }).eq('user_id', targetUserId)
        
        if (!err) {
          await sb.from('wallet_transactions').insert({
            user_id: targetUserId,
            type: 'credit',
            amount,
            currency: 'coins',
            description: `Admin grant by ${check.userId}`,
            transaction_source: 'admin_grant',
          })
        }
        updateError = err
        break
      }
      case 'add_gems': {
        const amount = parseInt(value) || 0
        if (amount <= 0 || amount > 1000) {
          return NextResponse.json({ error: 'amount must be 1–1000' }, { status: 400 })
        }
        const { data: wallet } = await sb.from('user_wallets')
          .select('gems').eq('user_id', targetUserId).single()
        const newGems = (wallet?.gems || 0) + amount
        const { error: err } = await sb.from('user_wallets').update({
          gems: newGems,
          updated_at: new Date().toISOString(),
        }).eq('user_id', targetUserId)
        
        if (!err) {
          await sb.from('wallet_transactions').insert({
            user_id: targetUserId,
            type: 'credit',
            amount,
            currency: 'gems',
            description: `Admin grant by ${check.userId}`,
            transaction_source: 'admin_grant',
          })
        }
        updateError = err
        break
      }
      case 'ban': {
        const { error: err } = await sb.from('user_plans').update({
          banned_at: new Date().toISOString(),
          ban_reason: (value as string) || (body.reason as string) || 'Admin action',
          updated_at: new Date().toISOString(),
        }).eq('user_id', targetUserId)
        updateError = err
        break
      }
      case 'unban': {
        const { error: err } = await sb.from('user_plans').update({
          banned_at: null,
          ban_reason: null,
          updated_at: new Date().toISOString(),
        }).eq('user_id', targetUserId)
        updateError = err
        break
      }
      case 'set_notes': {
        const { error: err } = await sb.from('user_plans').update({
          notes: (value as string) || (body.notes as string) || null,
          updated_at: new Date().toISOString(),
        }).eq('user_id', targetUserId)
        updateError = err
        break
      }
      case 'make_admin': {
        const { error: err } = await sb.from('user_plans').update({
          is_admin: true, updated_at: new Date().toISOString(),
        }).eq('user_id', targetUserId)
        updateError = err
        break
      }
      case 'remove_admin': {
        const { error: err } = await sb.from('user_plans').update({
          is_admin: false, updated_at: new Date().toISOString(),
        }).eq('user_id', targetUserId)
        updateError = err
        break
      }
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }

    if (updateError) {
      console.error('[AdminAPI] Update error:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    await sb.from('admin_logs').insert({
      admin_id:    check.userId,
      action,
      target_user: targetUserId,
      target_id:   targetUserId,
      target_type: 'user',
      payload:     body,
      details:     body,
    })

    return NextResponse.json({ ok: true, action, targetUserId })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[AdminAPI] Fatal error:', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const check = await verifyAdmin(req.headers.get('authorization'))
  if (!check.ok) return check.response

  const sb = getServiceSupabase()
  const targetUserId = params.id

  try {
    // Standard cascade relies on DB foreign keys, but we'll do an explicit cleanup
    // for safety in this admin route.
    await Promise.all([
      sb.from('user_plans').delete().eq('user_id', targetUserId),
      sb.from('user_wallets').delete().eq('user_id', targetUserId),
      sb.from('projects').delete().eq('workspaces.owner_id', targetUserId),
    ])

    // Log deletion before we lose context? No, it's done.

    return NextResponse.json({ ok: true, deleted: targetUserId })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
