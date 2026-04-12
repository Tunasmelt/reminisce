import { NextResponse } from 'next/server'
import { getServiceSupabase, supabase as clientSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

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

    // Check ban status
    const { data: plan } = await sb
      .from('user_plans')
      .select('banned_at')
      .eq('user_id', user.id)
      .single()
    if (plan?.banned_at)
      return NextResponse.json({ error: 'Account suspended' }, { status: 403 })

    const { id, title, content, tags, category } = await req.json()

    if (id) {
      // Update existing
      const { data, error } = await sb
        .from('prompt_templates')
        .update({ 
          title, content, tags, category,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ template: data })
    } else {
      // Create new
      const { data, error } = await sb
        .from('prompt_templates')
        .insert({
          user_id: user.id,
          title, content,
          tags: tags || [],
          category: category || 'GENERAL',
        })
        .select()
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ template: data })
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
