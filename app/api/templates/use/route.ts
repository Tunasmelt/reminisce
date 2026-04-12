import { NextResponse } from 'next/server'
import { getServiceSupabase, supabase as clientSupabase, verifyProjectAccess } from '@/lib/supabase'

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

    const { templateId, projectId, featureId } = await req.json()

    if (!templateId || !projectId)
      return NextResponse.json({ error: 'Missing templateId or projectId' }, { status: 400 })

    const sb = getServiceSupabase()

    // Verify the user owns the target project
    if (!await verifyProjectAccess(user.id, projectId))
      return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Get the template — must belong to this user
    const { data: template } = await sb
      .from('prompt_templates')
      .select('*')
      .eq('id', templateId)
      .eq('user_id', user.id)
      .single()

    if (!template)
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })

    // Insert into project's prompts
    const { data: prompt, error } = await sb
      .from('prompts')
      .insert({
        project_id:        projectId,
        feature_id:        featureId || null,
        raw_prompt:        template.content,
        structured_prompt: template.content,
        prompt_type:       template.category,
      })
      .select()
      .single()

    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 })

    // Increment use_count atomically
    await sb
      .from('prompt_templates')
      .update({ use_count: (template.use_count ?? 0) + 1 })
      .eq('id', templateId)

    return NextResponse.json({ success: true, prompt })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
