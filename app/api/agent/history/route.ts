import { NextResponse } from 'next/server'
import { getServiceSupabase, supabase as clientSupabase, verifyProjectAccess } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await clientSupabase.auth.getUser(token)
    if (!user || authError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId')

    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 })
    }

    if (!await verifyProjectAccess(user.id, projectId))
      return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const supabase = getServiceSupabase()

    const { data: runs, error } = await supabase
      .from('agent_runs')
      .select(`
        *,
        features (
          name
        )
      `)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) throw error

    return NextResponse.json({ runs })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('Agent history error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
