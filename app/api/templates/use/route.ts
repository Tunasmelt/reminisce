import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { verifyProjectAccess } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()

  if (!session)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { templateId, projectId, featureId } = await req.json()

  if (!templateId || !projectId)
    return NextResponse.json({ error: 'Missing templateId or projectId' }, { status: 400 })

  // Verify the user owns the target project
  if (!await verifyProjectAccess(session.user.id, projectId))
    return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Get the template — must belong to this user
  const { data: template } = await supabase
    .from('prompt_templates')
    .select('*')
    .eq('id', templateId)
    .eq('user_id', session.user.id)  // ← also enforces template ownership
    .single()

  if (!template)
    return NextResponse.json({ error: 'Template not found' }, { status: 404 })

  // Insert into project's prompts
  const { data: prompt, error } = await supabase
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
  await supabase
    .from('prompt_templates')
    .update({ use_count: (template.use_count ?? 0) + 1 })
    .eq('id', templateId)

  return NextResponse.json({ success: true, prompt })
}
