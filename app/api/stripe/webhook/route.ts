import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getServiceSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured')
  // @ts-expect-error Stripe types are incorrectly hardcoded to a future version
  return new Stripe(key, { apiVersion: '2024-06-20' })
}

export async function POST(req: Request) {
  const stripe = getStripe()
  const body = await req.text()
  const sig = req.headers.get('stripe-signature') as string
  
  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Missing sig' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body, 
      sig,
      process.env.STRIPE_WEBHOOK_SECRET as string
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Webhook signature failed:', message)
    return NextResponse.json(
      { error: `Invalid signature: ${message}` },
      { status: 400 }
    )
  }

  const supabase = getServiceSupabase()

  try {
    switch (event.type) {

      // ── SUBSCRIPTION CREATED / RENEWED ──────
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const metadata = (session.metadata || {}) as Record<string, string>
        const userId = metadata.supabase_user_id
        const type = metadata.type

        if (!userId) break

        if (type === 'subscription') {
          // Upgrade plan to pro
          await supabase
            .from('user_plans')
            .update({
              plan: 'pro',
              status: 'active',
              projects_limit: 999,
              stripe_subscription_id: session.subscription as string,
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', userId)

          // Grant 100 monthly gems
          const { data: wallet } = await supabase
            .from('user_wallets')
            .select('gems, gems_last_granted')
            .eq('user_id', userId)
            .single()

          const lastGranted = wallet?.gems_last_granted
              ? new Date(wallet.gems_last_granted)
              : new Date(0)
          const thirtyDaysAgo = new Date(
            Date.now() - 30 * 24 * 60 * 60 * 1000
          )

          if (lastGranted < thirtyDaysAgo) {
            await supabase
              .from('user_wallets')
              .update({
                gems: (wallet?.gems || 0) + 100,
                coins: 200,
                daily_coins_limit: 200,
                max_coins_banked: 500,
                gems_monthly_grant: 100,
                gems_last_granted: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq('user_id', userId)

            await supabase
              .from('wallet_transactions')
              .insert({
                user_id: userId,
                type: 'credit',
                amount: 100,
                currency: 'gems',
                description: 'Pro subscription — monthly gem grant',
                transaction_source: 'monthly_grant',
              })
          }

        } else if (type === 'gems') {
          // One-time gem purchase
          const gemsAmount = parseInt(metadata.gems_amount || '0')
          const packId = metadata.pack_id

          if (gemsAmount > 0) {
            const { data: wallet } = await supabase
              .from('user_wallets')
              .select('gems')
              .eq('user_id', userId)
              .single()

            await supabase
              .from('user_wallets')
              .update({
                gems: (wallet?.gems || 0) + gemsAmount,
                updated_at: new Date().toISOString(),
              })
              .eq('user_id', userId)

            await supabase
              .from('wallet_transactions')
              .insert({
                user_id: userId,
                type: 'credit',
                amount: gemsAmount,
                currency: 'gems',
                description: `Gem purchase: ${packId}`,
                transaction_source: 'purchase',
              })

            // Record purchase
            await supabase
              .from('gem_purchases')
              .insert({
                user_id: userId,
                amount_gems: gemsAmount,
                amount_paid_cents: session.amount_total || 0,
                stripe_payment_intent_id: session.payment_intent as string,
                status: 'complete',
              })
          }
        }
        break
      }

      // ── SUBSCRIPTION CANCELLED ───────────────
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const subscriptionId = subscription.id

        // ── Primary: look up user by stripe_subscription_id in our DB ─────────
        // This is reliable regardless of metadata presence.
        let userId: string | null = null

        const { data: planBySubId } = await supabase
          .from('user_plans')
          .select('user_id')
          .eq('stripe_subscription_id', subscriptionId)
          .maybeSingle()

        if (planBySubId?.user_id) {
          userId = planBySubId.user_id
        } else {
          // ── Fallback: metadata (works for subscriptions created after the fix) ─
          const metadata = (subscription.metadata || {}) as Record<string, string>
          userId = metadata.supabase_user_id || null
        }

        if (!userId) {
          console.error(
            `[stripe] subscription.deleted: could not resolve user for sub ${subscriptionId}`
          )
          break
        }

        // Downgrade to free
        await supabase
          .from('user_plans')
          .update({
            plan: 'free',
            status: 'cancelled',
            projects_limit: 2,
            stripe_subscription_id: null,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId)

        // Reset wallet to free limits
        await supabase
          .from('user_wallets')
          .update({
            daily_coins_limit: 50,
            max_coins_banked: 200,
            gems_monthly_grant: 0,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId)

        break
      }

      // ── SUBSCRIPTION RENEWED ─────────────────
      case 'invoice.paid': {
        const invoice = event.data.object as unknown as { subscription: string }
        const subId = invoice.subscription
        if (!subId) break

        const subscription = await stripe.subscriptions.retrieve(subId as string)
        const metadata = (subscription.metadata || {}) as Record<string, string>
        const userId = metadata.supabase_user_id
        if (!userId) break

        // Grant monthly gems on renewal
        const { data: wallet } = await supabase
          .from('user_wallets')
          .select('gems, gems_last_granted')
          .eq('user_id', userId)
          .single()

        const lastGranted = wallet?.gems_last_granted
          ? new Date(wallet.gems_last_granted)
          : new Date(0)
        const thirtyDaysAgo = new Date(
          Date.now() - 29 * 24 * 60 * 60 * 1000
        )

        if (lastGranted < thirtyDaysAgo) {
          const currentGems = wallet?.gems || 0
          const newGems = Math.min(
            currentGems + 100, 500
          ) // cap at 500 banked gems
          
          await supabase
            .from('user_wallets')
            .update({
              gems: newGems,
              gems_last_granted: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', userId)

          await supabase
            .from('wallet_transactions')
            .insert({
              user_id: userId,
              type: 'credit',
              amount: 100,
              currency: 'gems',
              description: 'Monthly gem renewal grant',
              transaction_source: 'monthly_grant',
            })
        }
        break
      }
    }

    return NextResponse.json({ received: true })
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('Webhook handler error:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
