import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { 
  supabase as clientSupabase,
  getServiceSupabase 
} from '@/lib/supabase'

export const dynamic = 'force-dynamic'

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured')
  return new Stripe(key, { apiVersion: '2026-02-25.clover' })
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL 
  || 'http://localhost:3000'

// Gem pack definitions — amounts in cents
const GEM_PACKS: Record<string, {
  gems: number
  amount: number
  name: string
}> = {
  gems_50:  { gems: 50,  amount: 500,  
               name: '50 Gems — Starter' },
  gems_150: { gems: 150, amount: 1200, 
               name: '150 Gems — Builder' },
  gems_400: { gems: 400, amount: 2500, 
               name: '400 Gems — Power' },
}

export async function POST(req: Request) {
  try {
    const stripe = getStripe()
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized' }, 
        { status: 401 }
      )
    }
    
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = 
      await clientSupabase.auth.getUser(token)
    if (!user || authError) {
      return NextResponse.json(
        { error: 'Unauthorized' }, 
        { status: 401 }
      )
    }

    const { type, packId } = await req.json()
    const supabase = getServiceSupabase()

    // Get or create Stripe customer
    const { data: planData } = await supabase
      .from('user_plans')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .single()

    let customerId = planData?.stripe_customer_id

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email || undefined,
        metadata: { supabase_user_id: user.id },
      })
      customerId = customer.id
      await supabase
        .from('user_plans')
        .update({ stripe_customer_id: customerId })
        .eq('user_id', user.id)
    }

    if (type === 'subscription') {
      // Pro monthly subscription
      const session = await stripe.checkout.sessions
        .create({
          customer: customerId,
          mode: 'subscription',
          line_items: [{
            price: process.env.STRIPE_PRO_PRICE_ID!,
            quantity: 1,
          }],
          success_url: 
            `${APP_URL}/dashboard?upgraded=true`,
          cancel_url: 
            `${APP_URL}/upgrade?cancelled=true`,
          metadata: {
            supabase_user_id: user.id,
            type: 'subscription',
          },
          subscription_data: {
            metadata: {
              supabase_user_id: user.id,
            },
          },
        })
      return NextResponse.json({ url: session.url })

    } else if (type === 'gems') {
      const pack = GEM_PACKS[packId]
      if (!pack) {
        return NextResponse.json(
          { error: 'Invalid pack' }, 
          { status: 400 }
        )
      }
      
      // One-time gem purchase
      const session = await stripe.checkout.sessions
        .create({
          customer: customerId,
          mode: 'payment',
          line_items: [{
            price_data: {
              currency: 'usd',
              unit_amount: pack.amount,
              product_data: { name: pack.name },
            },
            quantity: 1,
          }],
          success_url:
            `${APP_URL}/dashboard?gems_purchased=${pack.gems}`,
          cancel_url:
            `${APP_URL}/upgrade?cancelled=true`,
          metadata: {
            supabase_user_id: user.id,
            type: 'gems',
            gems_amount: String(pack.gems),
            pack_id: packId,
          },
        })
      return NextResponse.json({ url: session.url })
    }

    return NextResponse.json(
      { error: 'Invalid type' }, 
      { status: 400 }
    )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    console.error('Stripe checkout error:', err)
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    )
  }
}
