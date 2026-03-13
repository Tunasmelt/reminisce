import { NextResponse } from 'next/server'
import { getServiceSupabase, supabase as clientSupabase } from '@/lib/supabase'
import { diff_match_patch } from 'diff-match-patch'

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await clientSupabase.auth.getUser(token)
    if (!user || authError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { projectId, filePath, content } = await req.json()
    if (!projectId || !filePath || content === undefined) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    const supabase = getServiceSupabase()
    const dmp = new diff_match_patch()

    // 1. Find the current context record
    const { data: currentContext, error: contextErr } = await supabase
      .from('contexts')
      .select('*')
      .eq('project_id', projectId)
      .eq('file_path', filePath)
      .maybeSingle()

    if (contextErr) throw contextErr

    let finalContextId: string
    let newVersionNumber = 1

    if (currentContext) {
      finalContextId = currentContext.id
      newVersionNumber = (currentContext.version || 0) + 1
      
      const oldContent = currentContext.content || ''
      
      // Calculate diff from old to new
      const diffs = dmp.diff_main(oldContent, content)
      dmp.diff_cleanupSemantic(diffs)
      const diffJson = JSON.stringify(diffs)

      // Insert new version
      const { error: versionErr } = await supabase
        .from('context_versions')
        .insert({
          context_id: finalContextId,
          content: content,
          diff: diffJson,
          changed_at: new Date().toISOString()
        })

      if (versionErr) throw versionErr

      // Update main context record
      const { error: updateErr } = await supabase
        .from('contexts')
        .update({
          content: content,
          version: newVersionNumber,
          last_modified: new Date().toISOString()
        })
        .eq('id', finalContextId)

      if (updateErr) throw updateErr
    } else {
      // First version
      const { data: newContext, error: insertErr } = await supabase
        .from('contexts')
        .insert({
          project_id: projectId,
          file_path: filePath,
          content: content,
          version: 1,
          last_modified: new Date().toISOString()
        })
        .select()
        .single()

      if (insertErr) throw insertErr
      finalContextId = newContext.id

      // Insert initial version (diff empty for first version)
      const { error: versionErr } = await supabase
        .from('context_versions')
        .insert({
          context_id: finalContextId,
          content: content,
          diff: '', // Initial version has no diff
          changed_at: new Date().toISOString()
        })

      if (versionErr) throw versionErr
    }

    return NextResponse.json({ success: true, version: newVersionNumber })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('Context versioning error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
