import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { supabase as clientSupabase, getServiceSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured')
  // @ts-expect-error Stripe types are incorrectly hardcoded to a future version
  return new Stripe(key, { apiVersion: '2024-06-20' })
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } =
      await clientSupabase.auth.getUser(token)
    if (!user || authError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const sb = getServiceSupabase()

    const { data: plan } = await sb
      .from('user_plans')
      .select('stripe_subscription_id, plan, status')
      .eq('user_id', user.id)
      .single()

    if (!plan || plan.plan !== 'pro') {
      return NextResponse.json({ error: 'No active Pro subscription' }, { status: 400 })
    }

    if (!plan.stripe_subscription_id) {
      // Manual upgrade — downgrade immediately
      await sb.from('user_plans').update({
        plan: 'free', status: 'cancelled',
        projects_limit: 2, stripe_subscription_id: null,
        updated_at: new Date().toISOString(),
      }).eq('user_id', user.id)

      await sb.from('user_wallets').update({
        daily_coins_limit: 50, max_coins_banked: 200,
        gems_monthly_grant: 0, updated_at: new Date().toISOString(),
      }).eq('user_id', user.id)

      return NextResponse.json({ ok: true, cancelled: true, method: 'manual' })
    }

    // Cancel at period end — user keeps Pro until billing cycle ends
    const stripe = getStripe()
    await stripe.subscriptions.update(plan.stripe_subscription_id, {
      cancel_at_period_end: true,
    })

    // Mark status as cancelled in our DB, keep plan as 'pro'
    await sb.from('user_plans').update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    }).eq('user_id', user.id)

    return NextResponse.json({
      ok: true, cancelled: true, method: 'stripe',
    })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
