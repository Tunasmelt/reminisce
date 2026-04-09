import { NextResponse } from 'next/server'
import { getServiceSupabase, supabase as clientSupabase, verifyProjectAccess, isUserBanned } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// GET /api/pam/threads?projectId=xxx
// Returns all non-archived threads for a project, newest first.
export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } =
      await clientSupabase.auth.getUser(token)
    if (!user || authError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const projectId = searchParams.get('projectId')
    if (!projectId)
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 })

    if (!await verifyProjectAccess(user.id, projectId))
      return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const supabase = getServiceSupabase()
    const { data: threads, error } = await supabase
      .from('pam_threads')
      .select('id, title, model_used, provider_used, message_count, last_message_at, created_at')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .eq('archived', false)
      .order('last_message_at', { ascending: false })
      .limit(50)

    if (error) throw error
    return NextResponse.json({ threads })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// POST /api/pam/threads
// Creates a new thread and returns its id.
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

    if (await isUserBanned(user.id))
      return NextResponse.json({ error: 'Account suspended' }, { status: 403 })

    const { projectId, model, provider } = await req.json()
    if (!projectId)
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 })

    if (!await verifyProjectAccess(user.id, projectId))
      return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const supabase = getServiceSupabase()
    const { data: thread, error } = await supabase
      .from('pam_threads')
      .insert({
        project_id:    projectId,
        user_id:       user.id,
        model_used:    model    ?? null,
        provider_used: provider ?? null,
      })
      .select('id, title, created_at')
      .single()

    if (error) throw error
    return NextResponse.json({ thread })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
