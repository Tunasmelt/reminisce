import { decrypt } from '@/lib/encryption'
import { getServiceSupabase } from '@/lib/supabase'

export async function callAI(params: {
  userId: string
  provider: 'openrouter' | 'mistral' | 'gemini' | 'minimax'
  model: string
  messages: { role: 'user' | 'assistant' | 'system'; content: string }[]
  stream?: boolean
  temperature?: number
  max_tokens?: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
}): Promise<Response | any> {
  const FREE_FALLBACK = 'meta-llama/llama-3.3-70b-instruct:free'
  
  const MODEL_ALIASES: Record<string, string> = {
    'auto:free': FREE_FALLBACK,
    'google/gemini-2.0-flash-exp:free': FREE_FALLBACK,
    'google/gemini-2.0-flash-lite:free': FREE_FALLBACK,
  }
  
  const resolvedModel = MODEL_ALIASES[params.model] ?? params.model

  const { userId, provider, messages, stream, temperature, max_tokens } = params
  const model = resolvedModel
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
    }
  }
  
  if (!apiKey) {
    throw new Error(`No API key found for provider ${provider}`)
  }

  // 4. Route to correct provider
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
    res = await fetch('https://api.minimax.chat/v1/text/chatcompletion_v2', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        model, 
        messages: messages.map(m => ({
          sender_type: m.role === 'user' ? 'USER' : 'BOT',
          sender_name: m.role === 'user' ? 'User' : 'Bot',
          text: m.content
        })), 
        stream: !!stream 
      }),
    })
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
    throw new Error(`Provider ${provider} error: ${errorText}`)
  }
  
  if (stream) {
    return res
  }
  
  return await res.json()
}
