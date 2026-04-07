import { NextResponse } from 'next/server'
import JSZip from 'jszip'
import { getServiceSupabase, supabase as clientSupabase } from '@/lib/supabase'

export async function POST(req: Request) {
  try {
    // ── Auth ─────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('authorization')
    if (!authHeader)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } =
      await clientSupabase.auth.getUser(token)
    if (!user || authError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { projectId, files } = await req.json()
    if (!projectId || !files)
      return NextResponse.json({ error: 'Missing projectId or files' }, { status: 400 })

    // ── Ownership check ───────────────────────────────────────────────────────
    // Verify the project belongs to this user's workspace
    const supabase = getServiceSupabase()
    const { data: project } = await supabase
      .from('projects')
      .select('id, workspaces!inner(owner_id)')
      .eq('id', projectId)
      .single()

    if (!project || (project.workspaces as unknown as { owner_id: string }).owner_id !== user.id)
      return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // ── Build zip ────────────────────────────────────────────────────────────
    const zip = new JSZip()
    for (const [path, content] of Object.entries(files)) {
      // Sanitise path — prevent directory traversal
      const safePath = String(path).replace(/\.\.\//g, '').replace(/^\//, '')
      zip.file(`reminisce/${safePath}`, content as string)
    }

    const zipBuffer = await zip.generateAsync({ type: 'uint8array' })

    return new Response(zipBuffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="reminisce-${projectId}.zip"`,
      },
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
