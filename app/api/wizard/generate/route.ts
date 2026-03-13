import { NextResponse } from 'next/server'
import { getServiceSupabase, supabase as clientSupabase } from '@/lib/supabase'
import { callAI } from '@/lib/ai-client'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await clientSupabase.auth.getUser(token)
    if (!user || authError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { sessionId, projectId, provider = 'mistral', model = 'mistral-small-latest' } = await req.json()
    if (!sessionId || !projectId) return NextResponse.json({ error: 'Missing params' }, { status: 400 })

    const supabase = getServiceSupabase()
    
    // Load session
    const { data: session } = await supabase.from('wizard_sessions')
      .select('*').eq('id', sessionId).eq('project_id', projectId).single()
      
    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

    const generatePrompt = `You are a technical architect. Based on the preceding conversation, generate a JSON blueprint for the project. Output ONLY valid JSON, do not include any markdown formatting, explanations, or text outside the JSON object.
The JSON must have exactly this structure:
{
  "architecture": "string description",
  "techStack": {
    "frontend": "string",
    "backend": "string", 
    "database": "string",
    "other": "string"
  },
  "phases": [
    {
      "name": "string",
      "description": "string",
      "order_index": number,
      "features": [
        {
          "name": "string",
          "description": "string",
          "type": "frontend|backend|database|testing|architecture"
        }
      ]
    }
  ],
  "agentAssignments": {
    "featureName": "modelId"
  },
  "markdownFiles": {
    "context/architecture.md": "full content",
    "context/tech-stack.md": "full content",
    "context/api-design.md": "full content",
    "context/database-schema.md": "full content",
    "context/coding-guidelines.md": "full content",
    "context/ai-governance.md": "full content",
    "context/product-scope.md": "full content",
    "workflow/phases.md": "full content",
    "workflow/feature-roadmap.md": "full content",
    "workflow/development-workflow.md": "full content",
    "logs/development-log.md": "full content"
  }
}`

    const messages = [...session.messages, { role: 'user', content: generatePrompt }]

    const aiResponse = await callAI({
      userId: user.id,
      provider: provider,
      model: model,
      messages,
      stream: false
    })

    let jsonString = aiResponse.choices[0].message.content
    // Strip markdown fences
    jsonString = jsonString.replace(/^```[a-z]*\n?/mi, '').replace(/```$/m, '').trim()
    
    let parsed
    try {
      parsed = JSON.parse(jsonString)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      console.error('Failed to parse JSON:', jsonString)
      throw new Error('AI did not return valid JSON: ' + e.message)
    }

    // --- FEATURE 1: GENERATE PROMPTS ---
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let parsedPrompts: any = null
    try {
      const promptContext = JSON.stringify({
        architecture: parsed.architecture,
        phases: parsed.phases
      })
      const promptMessages = [...session.messages, {
        role: 'user',
        content: `Based on this project architecture and phases, generate specific development prompts for each phase and feature. Return ONLY valid JSON:
{
  "prompts": {
    "phases": {
      "[phase name]": {
        "overview_prompt": "full prompt for starting this phase",
        "completion_checklist": ["item1", "item2"]
      }
    },
    "features": {
      "[feature name]": {
        "build_prompt": "full structured prompt for building this feature",
        "type": "frontend|backend|database|testing",
        "context_files_needed": ["architecture.md", "tech-stack.md"],
        "expected_output": "what this prompt should produce"
      }
    }
  }
}
Include the project architecture and phases JSON as context. Output ONLY JSON, no markdown.

Context: 
${promptContext}`
      }]

      const promptsAiResponse = await callAI({
        userId: user.id,
        provider: provider,
        model: model,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        messages: promptMessages as any,
        stream: false
      })

      let promptsJsonString = promptsAiResponse.choices[0].message.content
      promptsJsonString = promptsJsonString.replace(/^```[a-z]*\n?/mi, '').replace(/```$/m, '').trim()
      parsedPrompts = JSON.parse(promptsJsonString)

      if (!parsed.markdownFiles) parsed.markdownFiles = {}

      if (parsedPrompts?.prompts?.phases) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const [phaseName, pData] of Object.entries<any>(parsedPrompts.prompts.phases)) {
          const slug = phaseName.toLowerCase().replace(/[^a-z0-9]+/g, '-')
          let content = `# ${phaseName} — Development Prompts\n\n## Overview Prompt\n${pData.overview_prompt}\n\n## Completion Checklist\n`
          pData.completion_checklist?.forEach((item: string) => {
            content += `- ${item}\n`
          })
          parsed.markdownFiles[`prompts/phase-${slug}.md`] = content
        }
      }

      if (parsedPrompts?.prompts?.features) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const [featureName, fData] of Object.entries<any>(parsedPrompts.prompts.features)) {
          const slug = featureName.toLowerCase().replace(/[^a-z0-9]+/g, '-')
          let content = `# ${featureName} — Development Prompt\n\n## Build Prompt\n${fData.build_prompt}\n\n## Context Files Needed\n`
          fData.context_files_needed?.forEach((file: string) => {
            content += `- ${file}\n`
          })
          content += `\n## Expected Output\n${fData.expected_output}`
          parsed.markdownFiles[`prompts/feature-${slug}.md`] = content
        }
      }
      
      parsed.prompts = parsedPrompts.prompts

    } catch (e) {
      console.error('Failed to generate prompts', e)
    }
    // ------------------------------------

    // Clear existing graph, features, phases for this project in case of regeneration
    await supabase.from('graph_edges').delete().eq('project_id', projectId)
    await supabase.from('graph_nodes').delete().eq('project_id', projectId)
    await supabase.from('features').delete().eq('project_id', projectId)
    await supabase.from('phases').delete().eq('project_id', projectId)

    // Insert phases and features
    if (parsed.phases && Array.isArray(parsed.phases)) {
      for (const phase of parsed.phases) {
        const { data: phaseData, error: phaseErr } = await supabase.from('phases').insert({
          project_id: projectId,
          name: phase.name,
          description: phase.description,
          order_index: phase.order_index || 0
        }).select().single()

        if (phaseErr) throw phaseErr

        // Add phase graph node
        await supabase.from('graph_nodes').insert({
          project_id: projectId,
          type: 'phase',
          label: phase.name,
          status: 'planned',
          position_x: 0,
          position_y: (phase.order_index || 0) * 200,
          metadata: { phase_id: phaseData.id }
        })

        if (phase.features && Array.isArray(phase.features)) {
          let fIndex = 0
          for (const feature of phase.features) {
            const { data: fData, error: fErr } = await supabase.from('features').insert({
              project_id: projectId,
              phase_id: phaseData.id,
              name: feature.name,
              description: feature.description,
              type: feature.type,
              status: 'planned',
              assigned_model: parsed.agentAssignments?.[feature.name] || 'mistral-small-latest',
              priority: fIndex + 1
            }).select().single()

            if (fErr) throw fErr

            if (parsedPrompts?.prompts?.features?.[feature.name]) {
              const fPrompt = parsedPrompts.prompts.features[feature.name]
              await supabase.from('prompts').insert({
                project_id: projectId,
                feature_id: fData.id,
                raw_prompt: fPrompt.build_prompt,
                structured_prompt: fPrompt.build_prompt,
                prompt_type: 'FEATURE_BUILD'
              })
            }

            // Add feature graph node
            await supabase.from('graph_nodes').insert({
              project_id: projectId,
              type: 'feature',
              label: feature.name,
              status: 'planned',
              position_x: 250,
              position_y: ((phase.order_index || 0) * 200) + (fIndex * 80),
              metadata: { feature_id: fData.id, type: feature.type }
            })
            fIndex++
          }
        }
      }
    }

    // Update wizard session
    const { error: updErr } = await supabase.from('wizard_sessions')
      .update({
        status: 'complete',
        architecture: { description: parsed.architecture },
        workflow: parsed.techStack
      })
      .eq('id', session.id)

    if (updErr) throw updErr

    return NextResponse.json(parsed)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('Generate error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
