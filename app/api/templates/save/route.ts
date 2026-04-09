import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Check ban status
  const { data: plan } = await supabase
    .from('user_plans')
    .select('banned_at')
    .eq('user_id', session.user.id)
    .single()
  if (plan?.banned_at)
    return NextResponse.json({ error: 'Account suspended' }, { status: 403 })

  const { id, title, content, tags, category } = await req.json()

  if (id) {
    // Update existing
    const { data, error } = await supabase
      .from('prompt_templates')
      .update({ 
        title, content, tags, category,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', session.user.id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ template: data })
  } else {
    // Create new
    const { data, error } = await supabase
      .from('prompt_templates')
      .insert({
        user_id: session.user.id,
        title, content,
        tags: tags || [],
        category: category || 'GENERAL',
      })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ template: data })
  }
}
