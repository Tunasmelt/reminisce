import { NextResponse } from 'next/server'
import { getServiceSupabase, supabase as clientSupabase } from '@/lib/supabase'

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await clientSupabase.auth.getUser(token)
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getServiceSupabase()
    const { data, error } = await supabase
      .from('user_api_keys')
      .select('provider')
      .eq('user_id', user.id)

    if (error) throw error

    return NextResponse.json({ providers: data.map(d => d.provider) })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
