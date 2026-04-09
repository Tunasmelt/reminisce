import { NextResponse } from 'next/server'
import { getServiceSupabase, 
         supabase as clientSupabase } 
  from '@/lib/supabase'
import { canCreateProject } from '@/lib/wallet'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
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
    
    // Check project limit
    const check = await canCreateProject(user.id)
    if (!check.allowed) {
      return NextResponse.json(
        { 
          error: check.reason,
          code: 'PROJECT_LIMIT_REACHED',
          current: check.current,
          limit: check.limit,
        },
        { status: 403 }
      )
    }
    
    const body = await req.json()
    const { name, description, workspaceId, 
            repoUrl, techStack } = body
    
    if (!name || !workspaceId) {
      return NextResponse.json(
        { error: 'Missing name or workspaceId' },
        { status: 400 }
      )
    }
    
    const supabase = getServiceSupabase()

    // ── Ownership check: verify this workspace belongs to the caller ──────
    const { data: ws, error: wsErr } = await supabase
      .from('workspaces')
      .select('id, owner_id')
      .eq('id', workspaceId)
      .single()

    if (wsErr || !ws) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      )
    }

    if (ws.owner_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden: workspace does not belong to you' },
        { status: 403 }
      )
    }

    const { data, error } = await supabase
      .from('projects')
      .insert({
        workspace_id: workspaceId,
        name,
        description: description || null,
        repo_url: repoUrl || null,
        tech_stack: techStack || [],
      })
      .select()
      .single()
    
    if (error) throw error
    
    return NextResponse.json({ project: data })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    )
  }
}
