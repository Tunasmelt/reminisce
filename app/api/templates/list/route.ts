import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tag = req.nextUrl.searchParams.get('tag')
  const category = req.nextUrl.searchParams.get('category')
  const search = req.nextUrl.searchParams.get('search')

  let query = supabase
    .from('prompt_templates')
    .select('*')
    .eq('user_id', session.user.id)
    .order('use_count', { ascending: false })

  if (tag) {
    query = query.contains('tags', [tag])
  }
  if (category && category !== 'ALL') {
    query = query.eq('category', category)
  }
  if (search) {
    query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ templates: data })
}
