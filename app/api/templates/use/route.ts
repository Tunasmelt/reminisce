import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { templateId, projectId, featureId } = await req.json()

  // Get the template
  const { data: template } = await supabase
    .from('prompt_templates')
    .select('*')
    .eq('id', templateId)
    .single()

  if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 })

  // Insert into project's prompts
  const { data: prompt, error } = await supabase
    .from('prompts')
    .insert({
      project_id: projectId,
      feature_id: featureId || null,
      raw_prompt: template.content,
      structured_prompt: template.content,
      prompt_type: template.category,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Increment use_count
  await supabase
    .from('prompt_templates')
    .update({ use_count: template.use_count + 1 })
    .eq('id', templateId)

  return NextResponse.json({ success: true, prompt })
}
