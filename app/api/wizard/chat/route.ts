import { NextResponse } from 'next/server'
import { getServiceSupabase, supabase as clientSupabase } from '@/lib/supabase'
import { callAI } from '@/lib/ai-client'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function POST(req: Request) {
  try {
    let authUser = null;
    try {
      const supabaseAuth = createRouteHandlerClient({ cookies })
      const { data: { user } } = await supabaseAuth.auth.getUser()
      authUser = user;
    } catch {}

    if (!authUser) {
      const authHeader = req.headers.get('authorization')
      if (authHeader) {
        const token = authHeader.replace('Bearer ', '')
        const { data: { user } } = await clientSupabase.auth.getUser(token)
        authUser = user;
      }
    }

    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { sessionId, message, projectId, provider = 'mistral', model = 'mistral-small-latest' } = await req.json()
    if (!message || !projectId) return NextResponse.json({ error: 'Missing params' }, { status: 400 })

    const supabase = getServiceSupabase()

    let session;
    if (sessionId) {
      const { data } = await supabase.from('wizard_sessions').select('*').eq('id', sessionId).single()
      session = data
    }

    if (!session) {
      const { data, error } = await supabase.from('wizard_sessions')
        .insert({ project_id: projectId, status: 'active', messages: [] })
        .select().single()
      if (error) throw error
      session = data
    }

    const messages = session?.messages ?? []
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hasSystemPrompt = messages.some((m: any) => m.role === 'system')
    if (!hasSystemPrompt) {
      messages.unshift({
        role: 'system',
        content: `You are Wizard, an AI project architect inside Reminisce. Your job is to understand a developer's project idea through conversation and generate a complete structured development blueprint. Ask about target users, core features, preferred stack, deployment preferences, and timeline. Ask ONE question at a time. Be concise. After 4-5 exchanges you will have enough context to generate the full project. When ready, end your message with exactly this text on a new line: [READY_TO_GENERATE]`
      })
    }

    messages.push({ role: 'user', content: message })

    await supabase.from('wizard_sessions').update({ messages }).eq('id', session.id)

    const aiResponse = await callAI({
      userId: authUser.id,
      provider: provider,
      model: model,
      messages,
      stream: true
    })

    if (!aiResponse.body) {
      throw new Error('No body in AI response')
    }

    const decoder = new TextDecoder()
    let assistantMessage = ''
    let buffer = ''

    const transformStream = new TransformStream({
      transform(chunk, controller) {
        try {
          const text = decoder.decode(chunk, { stream: true })
          buffer += text
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''
          
          for (const line of lines) {
            const trimmed = line.trim()
            if (trimmed.startsWith('data: ') && trimmed !== 'data: [DONE]') {
              try {
                const data = JSON.parse(trimmed.slice(6))
                if (data.choices?.[0]?.delta?.content) {
                  assistantMessage += data.choices[0].delta.content
                }
              } catch {}
            }
          }
        } catch (e) {
          console.error("Stream parsing error:", e)
        }
        controller.enqueue(chunk) // forward verbatim
      },
      async flush() {
        if (buffer.trim()) {
           const trimmed = buffer.trim()
           if (trimmed.startsWith('data: ') && trimmed !== 'data: [DONE]') {
             try {
               const data = JSON.parse(trimmed.slice(6))
               if (data.choices?.[0]?.delta?.content) {
                 assistantMessage += data.choices[0].delta.content
               }
             } catch {}
           }
        }
        const finalMessages = [...messages, { role: 'assistant', content: assistantMessage }]
        await supabase.from('wizard_sessions').update({ messages: finalMessages }).eq('id', session.id)
      }
    })

    return new Response(aiResponse.body.pipeThrough(transformStream), {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Session-Id': session.id
      }
    })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('Wizard chat error:', error)
    const errString = typeof error === 'object' ? JSON.stringify(error) : String(error)
    
    if (errString.includes('429') || errString.toLowerCase().includes('rate limit') || errString.toLowerCase().includes('too many requests')) {
      return NextResponse.json(
        {
          error: 'rate_limited',
          message: 'This model is rate limited. Please select a different model.',
          status: 429
        },
        { status: 429 }
      )
    }

    return NextResponse.json(
      { error: errString, stack: error?.stack || '' },
      { status: 500 }
    )
  }
}
