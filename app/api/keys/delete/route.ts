import { NextResponse } from 'next/server'
import { getServiceSupabase, supabase as clientSupabase } from '@/lib/supabase'

export async function DELETE(req: Request) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await clientSupabase.auth.getUser(token)
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // BYOK is Pro-only
    const supabaseService = getServiceSupabase()
    const { data: planData } = await supabaseService
      .from('user_plans')
      .select('plan')
      .eq('user_id', user.id)
      .single()
    
    if (!planData || planData.plan !== 'pro') {
      return NextResponse.json(
        { 
          error: 'BYOK requires a Pro subscription.',
          code: 'BYOK_PRO_REQUIRED'
        },
        { status: 403 }
      )
    }

    const { provider } = await req.json()
    if (!provider) return NextResponse.json({ error: 'Missing provider' }, { status: 400 })

    const supabase = getServiceSupabase()
    const { error } = await supabase
      .from('user_api_keys')
      .delete()
      .eq('user_id', user.id)
      .eq('provider', provider)

    if (error) throw error

    return NextResponse.json({ success: true })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
