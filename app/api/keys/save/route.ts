import { NextResponse } from 'next/server'
import { getServiceSupabase, supabase as clientSupabase } from '@/lib/supabase'
import { encrypt } from '@/lib/encryption'

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await clientSupabase.auth.getUser(token)
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { provider, apiKey, label } = await req.json()
    if (!provider || !apiKey) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    const encrypted_key = encrypt(apiKey)
    const supabase = getServiceSupabase()

    const { error } = await supabase
      .from('user_api_keys')
      .upsert(
        { 
          user_id: user.id, 
          provider, 
          encrypted_key, 
          label,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'user_id, provider' }
      )

    if (error) throw error

    return NextResponse.json({ success: true })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
