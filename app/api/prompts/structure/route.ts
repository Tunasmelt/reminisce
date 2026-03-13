import { NextResponse } from 'next/server'
import { getServiceSupabase, supabase as clientSupabase } from '@/lib/supabase'
import { callAI } from '@/lib/ai-client'

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await clientSupabase.auth.getUser(token)
    if (!user || authError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { rawPrompt, projectId, featureId, provider, model } = await req.json()
    
    if (!rawPrompt || !projectId || !provider || !model) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    const supabase = getServiceSupabase()

    // 1. Detect Prompt Type
    let promptType = 'FEATURE_BUILD'
    const lowerRaw = rawPrompt.toLowerCase()
    if (lowerRaw.match(/fix|bug|error|broken|crash/)) promptType = 'BUG_FIX'
    else if (lowerRaw.match(/refactor|clean|restructure|optimize/)) promptType = 'REFACTOR'
    else if (lowerRaw.match(/test|endpoint|api|postman|swagger/)) promptType = 'API_TEST'
    else if (lowerRaw.match(/design|architect|system|structure/)) promptType = 'ARCHITECTURE'
    else if (lowerRaw.match(/build|implement|create|add|develop/)) promptType = 'FEATURE_BUILD'

    // 2. Load Context Files
    const contextPaths = ['reminisce/context/ai-governance.md', 'reminisce/context/architecture.md']
    
    // Fetch feature name/desc if featureId provided
    let featureData = null
    if (featureId) {
      const { data: feature } = await supabase
        .from('features')
        .select('*')
        .eq('id', featureId)
        .single()
      featureData = feature
    }

    const { data: contexts } = await supabase
      .from('contexts')
      .select('file_path, content')
      .eq('project_id', projectId)
      .in('file_path', contextPaths)

    const archContent = contexts?.find(c => c.file_path.endsWith('architecture.md'))?.content || 'Architecture not defined.'
    const govContent = contexts?.find(c => c.file_path.endsWith('ai-governance.md'))?.content || 'AI constraints not defined.'

    // 3. Build Structured Template
    let expectedOutput = 'Full implementation with file paths and code.'
    if (promptType === 'BUG_FIX') expectedOutput = 'Patch-style fix with explanation.'
    else if (promptType === 'API_TEST') expectedOutput = 'Test cases + example requests.'
    else if (promptType === 'REFACTOR') expectedOutput = 'Refactored code with changes noted.'
    else if (promptType === 'ARCHITECTURE') expectedOutput = 'System design diagram + decisions.'

    const structuredTemplate = `
GOAL
${rawPrompt}

PROJECT CONTEXT
${archContent.substring(0, 500)}

FEATURE SCOPE
${featureData ? `${featureData.name}: ${featureData.description}` : 'N/A'}

CONSTRAINTS
${govContent.substring(0, 300)}

EXPECTED OUTPUT
${expectedOutput}
`.trim()

    // 4. Call AI to improve
    const aiResponse = await callAI({
      userId: user.id,
      provider,
      model,
      messages: [
        {
          role: 'system',
          content: 'You are Codeck, a prompt engineering assistant. Take the raw developer prompt and context provided and rewrite it as a clear, structured, production-ready AI development prompt. Be specific, include file paths if relevant, and make the expected output explicit. Return ONLY the final structured prompt, no conversational filler.'
        },
        {
          role: 'user',
          content: structuredTemplate
        }
      ]
    })

    const finalPrompter = aiResponse.choices?.[0]?.message?.content || aiResponse.text || 'Error generating prompt.'

    // 5. Save to database
    const { data: newPrompt, error: saveErr } = await supabase
      .from('prompts')
      .insert({
        project_id: projectId,
        feature_id: featureId || null,
        raw_prompt: rawPrompt,
        structured_prompt: finalPrompter,
        prompt_type: promptType,
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (saveErr) throw saveErr

    return NextResponse.json({ 
      promptId: newPrompt.id, 
      structuredPrompt: finalPrompter, 
      promptType 
    })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('Prompt structure error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
