import { decrypt } from '@/lib/encryption'
import { getServiceSupabase } from '@/lib/supabase'

export async function callAI(params: {
  userId: string
  provider: 'openrouter' | 'mistral' | 'gemini' | 'minimax' | 'anthropic'
  model: string
  messages: { role: 'user' | 'assistant' | 'system'; content: string }[]
  stream?: boolean
  temperature?: number
  max_tokens?: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
}): Promise<Response | any> {
  const MODEL_ALIASES: Record<string, string> = {
    'auto:free': 'meta-llama/llama-3.3-70b-instruct:free',
    'google/gemini-2.0-flash-exp:free': 
      'google/gemini-2.0-flash-exp:free',
    'google/gemini-2.0-flash-lite:free': 
      'google/gemini-2.0-flash-lite:free',
    'mistral/free': 'mistralai/mistral-7b-instruct:free',
  }
  
  const resolvedModel = MODEL_ALIASES[params.model] ?? params.model

  // If model contains '/' it's an OpenRouter 
  // model identifier — force openrouter provider
  let effectiveProvider = params.provider
  const effectiveModel = resolvedModel
  
  if (resolvedModel.includes('/')) {
    effectiveProvider = 'openrouter'
  }

  const { userId, messages, stream, temperature, max_tokens } = params
  const model = effectiveModel
  const provider = effectiveProvider
  const supabase = getServiceSupabase()
  
  let apiKey = ''
  
  // 1. Fetch user's API key
  const { data: userKeyData } = await supabase
    .from('user_api_keys')
    .select('encrypted_key')
    .eq('user_id', userId)
    .eq('provider', provider)
    .single()
    
  if (userKeyData?.encrypted_key) {
    apiKey = decrypt(userKeyData.encrypted_key)
  }
  
  if (!apiKey) {
    // 2. Fall back to platform key
    switch (provider) {
      case 'openrouter':
        apiKey = process.env.OPENROUTER_API_KEY || ''
        break
      case 'mistral':
        apiKey = process.env.MISTRAL_API_KEY || ''
        break
      case 'gemini':
        apiKey = process.env.GEMINI_API_KEY || ''
        break
      case 'minimax':
        apiKey = process.env.MINIMAX_API_KEY || ''
        break
      case 'anthropic':
        apiKey = process.env.ANTHROPIC_API_KEY || ''
        break
    }
  }
  
  if (!apiKey) {
    throw new Error(`No API key found for provider ${provider}`)
  }

  // 4. Route to correct provider
  
  if (provider === 'anthropic') {
    const Anthropic = (await import('@anthropic-ai/sdk')).default
    const client = new Anthropic({ apiKey })
    
    // Separate system messages from conversation
    const systemMsg = messages
      .filter(m => m.role === 'system')
      .map(m => m.content)
      .join('\n')
    
    const conversationMsgs = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      }))
    
    if (stream) {
      // Use streaming
      const streamResponse = await client.messages.stream({
        model: model,
        max_tokens: max_tokens || 4096,
        system: systemMsg || undefined,
        messages: conversationMsgs,
      })
      
      // Convert to OpenAI-compatible SSE format
      const encoder = new TextEncoder()
      const readable = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of streamResponse) {
              if (chunk.type === 'content_block_delta' 
                  && chunk.delta.type === 'text_delta') {
                const data = JSON.stringify({
                  choices: [{
                    delta: { content: chunk.delta.text }
                  }]
                })
                controller.enqueue(
                  encoder.encode(`data: ${data}\n\n`)
                )
              }
            }
            controller.enqueue(
              encoder.encode('data: [DONE]\n\n')
            )
          } catch (err) {
            controller.error(err)
          } finally {
            controller.close()
          }
        }
      })
      
      return new Response(readable, {
        headers: { 'Content-Type': 'text/event-stream' }
      })
    } else {
      const response = await client.messages.create({
        model: model,
        max_tokens: max_tokens || 4096,
        system: systemMsg || undefined,
        messages: conversationMsgs,
      })
      
      const textContent = response.content
        .filter(c => c.type === 'text')
        .map(c => c.type === 'text' ? c.text : '')
        .join('')
      
      return {
        choices: [{
          message: { role: 'assistant', content: textContent }
        }]
      }
    }
  }

  let res: Response
  
  if (provider === 'openrouter') {
    res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || '',
        'X-Title': 'Reminisce',
      },
      body: JSON.stringify({ model, messages, stream: !!stream, temperature, max_tokens }),
    })
  } else if (provider === 'mistral') {
    res = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, messages, stream: !!stream, temperature, max_tokens }),
    })
  } else if (provider === 'minimax') {
    // MiniMax uses OpenAI-compatible format
    res = await fetch(
      'https://api.minimax.io/v1/text/chatcompletion_v2',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: messages.map(m => ({
            role: m.role,
            content: typeof m.content === 'string'
              ? m.content
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              : (m.content as any).map((p: {type:string; text?:string}) =>
                  p.text || ''
                ).join(' ')
          })),
          stream: !!stream,
          temperature: temperature || 0.7,
          max_tokens: max_tokens || 2048,
        }),
      }
    )
  } else if (provider === 'gemini') {
    const formattedContents = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }))
    
    const endpoint = stream ? 'streamGenerateContent' : 'generateContent'
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:${endpoint}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: formattedContents }),
    })
    
    if (!res.ok) {
      const errorText = await res.text()
      throw new Error(`Gemini error: ${errorText}`)
    }
    
    if (stream) {
      return res
    } else {
      const data = await res.json()
      const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
      const openAIFormat = {
        choices: [
          {
            message: { role: 'assistant', content: textResponse }
          }
        ]
      }
      return openAIFormat
    }
  } else {
    throw new Error(`Unsupported provider: ${provider}`)
  }
  
  if (!res.ok) {
    const errorText = await res.text()
    let errorMsg = `${provider} error (${res.status})`
    
    try {
      const errJson = JSON.parse(errorText)
      const detail = errJson?.error?.message 
        || errJson?.message 
        || errJson?.error
        || errorText
      errorMsg = `${provider} (${res.status}): ${detail}`
    } catch {
      errorMsg = `${provider} (${res.status}): ${errorText.slice(0, 200)}`
    }
    
    // Specific known errors
    if (res.status === 429) {
      throw new Error(
        `Rate limit reached on ${provider}. ` +
        (provider === 'openrouter' 
          ? 'Free models allow 20 req/min. Wait 60 seconds or upgrade your OpenRouter account.'
          : 'Please wait a moment before trying again.')
      )
    }
    if (res.status === 401) {
      throw new Error(
        `Invalid API key for ${provider}. ` +
        'Check your key in Settings → Models.'
      )
    }
    if (res.status === 402 || res.status === 403) {
      throw new Error(
        `${provider} requires payment or credits. ` +
        'Add a payment method to your OpenRouter account (required even for free models).'
      )
    }
    if (res.status === 404) {
      throw new Error(
        `Model "${model}" not found on ${provider}. ` +
        'The model may have been renamed or removed.'
      )
    }
    
    throw new Error(errorMsg)
  }
  
  if (stream) {
    return res
  }
  
  return await res.json()
}

export async function userHasOwnKey(
  userId: string,
  provider: string
): Promise<boolean> {
  try {
    const { getServiceSupabase } = 
      await import('@/lib/supabase')
    const { decrypt } = 
      await import('@/lib/encryption')
    const supabase = getServiceSupabase()
    const { data } = await supabase
      .from('user_api_keys')
      .select('encrypted_key')
      .eq('user_id', userId)
      .eq('provider', provider)
      .single()
    if (!data?.encrypted_key) return false
    const key = decrypt(data.encrypted_key)
    return key.length > 0
  } catch {
    return false
  }
}
