import { NextResponse } from 'next/server'
import { getServiceSupabase, supabase as clientSupabase, verifyProjectAccess } from '@/lib/supabase'

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await clientSupabase.auth.getUser(token)
    if (!user || authError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId')
    const filePath = searchParams.get('filePath')

    if (!projectId || !filePath) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    if (!await verifyProjectAccess(user.id, projectId))
      return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const supabase = getServiceSupabase()

    // Find the current context record
    const { data: context, error: contextErr } = await supabase
      .from('contexts')
      .select('*')
      .eq('project_id', projectId)
      .eq('file_path', filePath)
      .maybeSingle()

    if (contextErr) throw contextErr

    if (!context) {
      return NextResponse.json({ versions: [], currentVersion: 0 })
    }

    // Get all versions
    const { data: versions, error: versionErr } = await supabase
      .from('context_versions')
      .select('*')
      .eq('context_id', context.id)
      .order('changed_at', { ascending: false })

    if (versionErr) throw versionErr

    return NextResponse.json({ versions, currentVersion: context.version })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('History load error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
