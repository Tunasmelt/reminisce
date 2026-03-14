import { NextResponse } from 'next/server'
import { getServiceSupabase, supabase as clientSupabase } from '@/lib/supabase'

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await clientSupabase.auth.getUser(token)
    if (!user || authError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId')
    const type = searchParams.get('type')

    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 })
    }

    const supabase = getServiceSupabase()

    let query = supabase
      .from('prompts')
      .select(`
        *,
        features (
          name,
          phases ( name )
        )
      `)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })

    if (type && type !== 'All') {
      query = query.eq('prompt_type', type)
    }

    const { data: prompts, error } = await query

    if (error) throw error

    return NextResponse.json({ prompts })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('List prompts error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
