import { decrypt } from '@/lib/encryption'
import { getServiceSupabase } from '@/lib/supabase'

// ─────────────────────────────────────────────────────
//  Provider type
// ─────────────────────────────────────────────────────

export type AIProvider =
  | 'groq'
  | 'cerebras'
  | 'sambanova'
  | 'gemini'
  | 'mistral'
  | 'anthropic'
  | 'openai'
  | 'kimi'
  | 'minimax'
  | 'openrouter'

// ─────────────────────────────────────────────────────
//  Base URLs
// ─────────────────────────────────────────────────────

const PROVIDER_BASE: Record<AIProvider, string> = {
  groq:       'https://api.groq.com/openai/v1',
  cerebras:   'https://api.cerebras.ai/v1',
  sambanova:  'https://api.sambanova.ai/v1',
  gemini:     'https://generativelanguage.googleapis.com/v1beta',
  mistral:    'https://api.mistral.ai/v1',
  anthropic:  'https://api.anthropic.com/v1',
  openai:     'https://api.openai.com/v1',
  kimi:       'https://api.moonshot.ai/v1',
  minimax:    'https://api.minimax.io/v1',
  openrouter: 'https://openrouter.ai/api/v1',
}

// ─────────────────────────────────────────────────────
//  Per-provider safe input token budget
//  Conservative estimates — actual limits are higher but
//  we leave headroom for system prompts and output tokens.
//  Estimated as: text.length / 4  ≈  token count
//  All values are in estimated tokens (chars / 4).
// ─────────────────────────────────────────────────────
const PROVIDER_CONTEXT_LIMITS: Partial<Record<AIProvider, number>> = {
  sambanova:  5500,   // platform caps at ~8K; keep safe headroom
  kimi:       28000,  // moonshot-v1-32k = 32K; kimi-k2.5 = 256K (use 32K safe)
  cerebras:   60000,  // 128K window but 60K TPM per minute is the real cap
  groq:       100000, // 128K window — trim only extremely long conversations
  gemini:     800000, // 1M token context — almost never a problem
  mistral:    100000, // 128K context window
  openai:     100000, // gpt-4o 128K context
  anthropic:  150000, // claude context (200K) — leave headroom for output
}

// ─────────────────────────────────────────────────────
//  Platform env key resolver
// ─────────────────────────────────────────────────────

function getPlatformKey(provider: AIProvider): string {
  switch (provider) {
    case 'groq':       return process.env.GROQ_API_KEY       || ''
    case 'cerebras':   return process.env.CEREBRAS_API_KEY   || ''
    case 'sambanova':  return process.env.SAMBANOVA_API_KEY  || ''
    case 'gemini':     return process.env.GEMINI_API_KEY     || ''
    case 'mistral':    return process.env.MISTRAL_API_KEY    || ''
    case 'anthropic':  return process.env.ANTHROPIC_API_KEY  || ''
    case 'openai':     return process.env.OPENAI_API_KEY     || ''
    case 'kimi':       return process.env.KIMI_API_KEY       || ''
    case 'minimax':    return process.env.MINIMAX_API_KEY    || ''
    case 'openrouter': return process.env.OPENROUTER_API_KEY || ''
  }
}

// ─────────────────────────────────────────────────────
//  Per-user rate limits (protects org-level API keys)
//  rpd: 9999 = no daily cap enforced (provider has none)
// ─────────────────────────────────────────────────────

const USER_RATE_LIMITS: Record<string, { rpm: number; rpd: number }> = {
  // Groq — free tier
  'llama-3.1-8b-instant':                          { rpm: 5, rpd: 300  },
  'llama-3.3-70b-versatile':                       { rpm: 2, rpd: 20   },
  'meta-llama/llama-4-scout-17b-16e-instruct':     { rpm: 3, rpd: 30   },
  'moonshotai/kimi-k2-instruct-0905':              { rpm: 3, rpd: 30   },
  'qwen/qwen3-32b':                                { rpm: 3, rpd: 30   },
  'mixtral-8x7b-32768':                          { rpm: 2, rpd: 50   },
  'qwen-2.5-coder-32b':                          { rpm: 3, rpd: 80   },
  // Cerebras — free tier (1M tokens/day org, no per-req daily cap)
  'llama3.1-8b':                                   { rpm: 5, rpd: 9999 },
  'llama-3.3-70b':                                 { rpm: 3, rpd: 9999 },
  'llama-4-scout-17b-16e-instruct':                { rpm: 3, rpd: 9999 },
  'qwen-3-32b':                                    { rpm: 3, rpd: 9999 },
  // SambaNova — free tier (no published daily cap)
  'Meta-Llama-3.1-8B-Instruct':                   { rpm: 5, rpd: 9999 },
  'Meta-Llama-3.1-70B-Instruct':                  { rpm: 3, rpd: 9999 },
  'Meta-Llama-3.1-405B-Instruct':                 { rpm: 1, rpd: 9999 },
  'Meta-Llama-3.3-70B-Instruct':                  { rpm: 3, rpd: 9999 },
  'Qwen2.5-72B-Instruct':                         { rpm: 3, rpd: 9999 },
  // Gemini — free tier
  'gemini-2.5-flash-lite':                        { rpm: 3, rpd: 100  },
  'gemini-2.5-flash':                             { rpm: 2, rpd: 25   },
  'gemini-1.5-flash-lite':                        { rpm: 5, rpd: 200  },
  // Mistral — Experiment plan (2 RPM org-wide)
  'open-mistral-7b':                              { rpm: 1, rpd: 50   },
  'mistral-small-latest':                         { rpm: 1, rpd: 50   },
  'codestral-latest':                             { rpm: 1, rpd: 50   },
  // Kimi — free tier
  'kimi-k2.5':                                    { rpm: 3, rpd: 50   },
  // Pro tier — billed, limits are generous
  'claude-haiku-4-5':                             { rpm: 10, rpd: 500 },
  'claude-sonnet-4-6-20250514':                   { rpm: 5,  rpd: 100 },
  'gpt-4o-mini':                                  { rpm: 10, rpd: 500 },
  'gpt-4o':                                       { rpm: 5,  rpd: 50  },
  'gemini-2.5-pro':                               { rpm: 3,  rpd: 50  },
  'mistral-large-latest':                         { rpm: 5,  rpd: 100 },
  'deepseek/deepseek-chat:free':                  { rpm: 3,  rpd: 50  },
  'nousresearch/hermes-3-llama-3.1-405b:free':    { rpm: 1,  rpd: 20  },
  'liquid/lfm-40b:free':                          { rpm: 5,  rpd: 200 },
}

async function checkUserRateLimit(
  userId: string,
  model: string,
): Promise<{ allowed: boolean; reason?: string }> {
  const limit = USER_RATE_LIMITS[model]
  if (!limit) return { allowed: true }

  const supabase = getServiceSupabase()
  const now = new Date()
  const minuteAgo = new Date(now.getTime() - 60_000).toISOString()
  const dayAgo    = new Date(now.getTime() - 86_400_000).toISOString()

  const [{ count: rpmCount }, { count: rpdCount }] = await Promise.all([
    supabase
      .from('wallet_transactions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('model_used', model)
      .gte('created_at', minuteAgo),
    supabase
      .from('wallet_transactions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('model_used', model)
      .gte('created_at', dayAgo),
  ])

  if ((rpmCount ?? 0) >= limit.rpm) {
    return {
      allowed: false,
      reason: `Rate limit reached for ${model}. Please wait 60 seconds.`,
    }
  }
  if (limit.rpd < 9999 && (rpdCount ?? 0) >= limit.rpd) {
    return {
      allowed: false,
      reason: `daily_limit_exceeded: Daily limit reached for ${model}. Try a different model or come back tomorrow.`,
    }
  }
  return { allowed: true }
}

// ─────────────────────────────────────────────────────
//  Exponential backoff on 429s
// ─────────────────────────────────────────────────────

async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelay = 1000,
): Promise<T> {
  let attempt = 0
  while (true) {
    try {
      return await fn()
    } catch (err: unknown) {
      attempt++
      const isRateLimit =
        err instanceof Error &&
        (err.message.startsWith('429') ||
          err.message.toLowerCase().includes('rate limit'))
      if (!isRateLimit || attempt >= maxAttempts) throw err
      const delay =
        baseDelay * Math.pow(2, attempt - 1) + Math.random() * 500
      await new Promise(r => setTimeout(r, delay))
    }
  }
}

// ─────────────────────────────────────────────────────
//  OpenAI-compatible fetch helper
//  Used by: groq, cerebras, sambanova, mistral,
//           openai, kimi, openrouter
// ─────────────────────────────────────────────────────

async function callOpenAICompat(params: {
  baseUrl: string
  apiKey: string
  model: string
  messages: { role: string; content: string }[]
  stream: boolean
  temperature?: number
  max_tokens?: number
  extraHeaders?: Record<string, string>
  provider: AIProvider
}): Promise<Response> {
  const {
    baseUrl, apiKey, model, messages,
    stream, temperature, max_tokens, extraHeaders, provider
  } = params

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
    body: JSON.stringify({
      model,
      messages,
      stream,
      temperature: temperature ?? 0.7,
      max_tokens: max_tokens ?? 4096,
    }),
  })

  if (!res.ok) {
    const errorText = await res.text()
    let errorMsg = `(${res.status})`
    try {
      const errJson = JSON.parse(errorText)
      errorMsg = errJson?.error?.message ||
        errJson?.message ||
        errJson?.error ||
        errorText
    } catch {
      errorMsg = errorText.slice(0, 300)
    }
    if (res.status === 429) {
      const retryAfter = res.headers.get('retry-after')
        ?? res.headers.get('x-ratelimit-reset-requests')
        ?? '60'
      const retrySeconds = parseInt(retryAfter, 10)
      const safeRetry = isNaN(retrySeconds) ? 60 : Math.min(retrySeconds, 300)
      throw new Error(`429: ${errorMsg} retry-after:${safeRetry}`)
    }
    if (res.status === 401)
      throw new Error(`Invalid API key. Check Settings → Models.`)
    if (res.status === 404)
      throw new Error(`Model "${model}" not found. It may have been renamed or removed.`)
    if (res.status === 503 || res.status === 502)
      throw new Error(`429: Model "${model}" is temporarily unavailable on ${provider}. Try a different model.`)
    if (res.status === 500)
      throw new Error(`429: Provider returned an error for "${model}". Try switching to a different model.`)
    throw new Error(`(${res.status}): ${errorMsg}`)
  }

  return res
}

// ─────────────────────────────────────────────────────
//  Gemini handler  (non-OpenAI-compat REST format)
// ─────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function callGemini(params: {
  apiKey: string
  model: string
  messages: { role: string; content: string }[]
  stream: boolean
  temperature?: number
  max_tokens?: number
// eslint-disable-next-line @typescript-eslint/no-explicit-any
}): Promise<Response | any> {
  const { apiKey, model, messages, stream, temperature, max_tokens } = params

  const systemMsgs = messages.filter(m => m.role === 'system')
  const convMsgs   = messages.filter(m => m.role !== 'system')

  const formattedContents = convMsgs.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))

  const body: Record<string, unknown> = { contents: formattedContents }
  if (systemMsgs.length > 0) {
    body.systemInstruction = {
      parts: [{ text: systemMsgs.map(m => m.content).join('\n') }],
    }
  }
  // Pass temperature and token cap as generationConfig
  const generationConfig: Record<string, unknown> = {}
  if (temperature !== undefined) generationConfig.temperature = temperature
  if (max_tokens !== undefined) generationConfig.maxOutputTokens = max_tokens
  if (Object.keys(generationConfig).length > 0) {
    body.generationConfig = generationConfig
  }

  const endpoint = stream ? 'streamGenerateContent' : 'generateContent'
  // alt=sse is required for streamGenerateContent to return true SSE format.
  // Without it, the API returns a JSON array and the SSE reader gets no data.
  const altParam = stream ? '&alt=sse' : ''
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:${endpoint}?key=${apiKey}${altParam}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  )

  if (!res.ok) {
    const errorText = await res.text()
    if (res.status === 429) {
      const retryAfter = res.headers.get('retry-after') ?? '60'
      const retrySeconds = parseInt(retryAfter, 10)
      const safeRetry = isNaN(retrySeconds) ? 60 : Math.min(retrySeconds, 300)
      throw new Error(`429: ${errorText} retry-after:${safeRetry}`)
    }
    throw new Error(`Gemini (${res.status}): ${errorText.slice(0, 300)}`)
  }

  if (stream) {
    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          const reader = res.body?.getReader()
          const decoder = new TextDecoder()
          let buffer = ''
          if (!reader) { controller.close(); return }
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''
            for (const line of lines) {
              const trimmed = line.trim()
              // Gemini SSE lines are prefixed with "data: "
              // All other lines (empty, event:, id:) are skipped
              if (!trimmed.startsWith('data: ')) continue
              const jsonStr = trimmed.slice(6) // strip "data: "
              if (jsonStr === '[DONE]') break
              try {
                const chunk = JSON.parse(jsonStr)
                const finishReason =
                  chunk?.candidates?.[0]?.finishReason
                if (
                  finishReason &&
                  finishReason !== 'STOP' &&
                  finishReason !== 'MAX_TOKENS'
                ) continue // safety block — emit nothing
                const text =
                  chunk?.candidates?.[0]?.content?.parts?.[0]?.text
                if (text) {
                  const data = JSON.stringify({
                    choices: [{ delta: { content: text } }],
                  })
                  controller.enqueue(encoder.encode(`data: ${data}\n\n`))
                }
              } catch { /* partial chunk */ }
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        } catch (err) {
          controller.error(err)
        } finally {
          controller.close()
        }
      },
    })
    return new Response(readable, {
      headers: { 'Content-Type': 'text/event-stream' },
    })
  }

  const data = await res.json()
  const textResponse =
    data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  return {
    choices: [{ message: { role: 'assistant', content: textResponse } }],
  }
}

// ─────────────────────────────────────────────────────
//  Anthropic handler  (SDK — own streaming format)
// ─────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function callAnthropic(params: {
  apiKey: string
  model: string
  messages: { role: string; content: string }[]
  stream: boolean
  max_tokens?: number
// eslint-disable-next-line @typescript-eslint/no-explicit-any
}): Promise<Response | any> {
  const { apiKey, model, messages, stream, max_tokens } = params
  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const client = new Anthropic({ apiKey })

  const systemMsg = messages
    .filter(m => m.role === 'system')
    .map(m => m.content)
    .join('\n')
  const conversationMsgs = messages
    .filter(m => m.role !== 'system')
    .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))

  if (stream) {
    const streamResponse = await client.messages.stream({
      model,
      max_tokens: max_tokens || 4096,
      system: systemMsg || undefined,
      messages: conversationMsgs,
    })
    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of streamResponse) {
            if (
              chunk.type === 'content_block_delta' &&
              chunk.delta.type === 'text_delta'
            ) {
              const data = JSON.stringify({
                choices: [{ delta: { content: chunk.delta.text } }],
              })
              controller.enqueue(encoder.encode(`data: ${data}\n\n`))
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        } catch (err) {
          controller.error(err)
        } finally {
          controller.close()
        }
      },
    })
    return new Response(readable, {
      headers: { 'Content-Type': 'text/event-stream' },
    })
  }

  const response = await client.messages.create({
    model,
    max_tokens: max_tokens || 4096,
    system: systemMsg || undefined,
    messages: conversationMsgs,
  })
  const textContent = response.content
    .filter(c => c.type === 'text')
    .map(c => (c.type === 'text' ? c.text : ''))
    .join('')
  return {
    choices: [{ message: { role: 'assistant', content: textContent } }],
  }
}

// ─────────────────────────────────────────────────────
//  MiniMax handler  (own endpoint path)
// ─────────────────────────────────────────────────────

async function callMinimax(params: {
  apiKey: string
  model: string
  messages: { role: string; content: string }[]
  stream: boolean
  temperature?: number
  max_tokens?: number
}): Promise<Response> {
  const { apiKey, model, messages, stream, temperature, max_tokens } = params
  const res = await fetch('https://api.minimax.io/v1/text/chatcompletion_v2', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      stream: !!stream,
      temperature: temperature || 0.7,
      max_tokens: max_tokens || 2048,
    }),
  })
  if (!res.ok) {
    const errorText = await res.text()
    if (res.status === 429) throw new Error(`429: ${errorText}`)
    throw new Error(`MiniMax (${res.status}): ${errorText.slice(0, 300)}`)
  }
  return res
}


// ─────────────────────────────────────────────────────
//  Main callAI entry point
// ─────────────────────────────────────────────────────

export async function callAI(params: {
  userId: string
  provider: AIProvider
  model: string
  messages: { role: 'user' | 'assistant' | 'system'; content: string }[]
  stream?: boolean
  temperature?: number
  max_tokens?: number
// eslint-disable-next-line @typescript-eslint/no-explicit-any
}): Promise<Response | any> {
  const {
    userId, provider, model, messages,
    stream = false, temperature, max_tokens,
  } = params

  // 1. Per-user rate limit check
  const rlCheck = await checkUserRateLimit(userId, model)
  if (!rlCheck.allowed) throw new Error(rlCheck.reason)

  // 2. Resolve API key — user's own key takes priority
  const supabase = getServiceSupabase()
  let apiKey = ''

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
    apiKey = getPlatformKey(provider)
  }

  // 3. OpenRouter fallback if no key configured for provider
  if (!apiKey && provider !== 'openrouter') {
    const orEnabled = process.env.OPENROUTER_ENABLED !== 'false'
    const orKey = process.env.OPENROUTER_API_KEY || ''
    if (orEnabled && orKey) {
      console.warn(
        `[ai-client] No key for provider "${provider}", falling back to OpenRouter`,
      )
      return callAI({ ...params, provider: 'openrouter' })
    }
    throw new Error(
      `No API key configured for "${provider}". ` +
      `Add ${provider.toUpperCase()}_API_KEY to your .env.local.`,
    )
  }

  if (!apiKey) {
    throw new Error(
      `No API key found for "${provider}". Check your .env.local file.`,
    )
  }

  // 4. Nemotron: prepend /no_think for OpenRouter models only
  let effectiveMessages = [...messages]
  if (provider === 'openrouter' && model.includes('nemotron')) {
    const hasSystem = effectiveMessages.some(m => m.role === 'system')
    if (hasSystem) {
      effectiveMessages = effectiveMessages.map(m =>
        m.role === 'system'
          ? { ...m, content: '/no_think\n\n' + m.content }
          : m,
      )
    } else {
      effectiveMessages = [
        { role: 'system', content: '/no_think' },
        ...effectiveMessages,
      ]
    }
  }

  // 4b. Context window guard — trim message history if the
  // estimated token count exceeds the provider's safe input limit.
  // We estimate tokens as Math.ceil(text.length / 4) — rough but
  // reliable enough to catch runaway wizard conversations.
  // Strategy: always keep the system message, then fill remaining
  // budget with the most recent messages (newest first).
  const contextLimit = PROVIDER_CONTEXT_LIMITS[provider]
  if (contextLimit) {
    const systemMsgs = effectiveMessages.filter(m => m.role === 'system')
    const nonSystemMsgs = effectiveMessages.filter(m => m.role !== 'system')

    const systemTokens = systemMsgs
      .map(m => Math.ceil(m.content.length / 4))
      .reduce((a, b) => a + b, 0)

    let budget = contextLimit - systemTokens
    const keptMessages: typeof nonSystemMsgs = []

    // Walk messages newest-first, keeping until budget is exhausted
    for (let i = nonSystemMsgs.length - 1; i >= 0; i--) {
      const est = Math.ceil(nonSystemMsgs[i].content.length / 4)
      if (budget - est < 500) break // keep 500-token buffer for safety
      keptMessages.unshift(nonSystemMsgs[i])
      budget -= est
    }

    const totalBefore = effectiveMessages
      .map(m => Math.ceil(m.content.length / 4))
      .reduce((a, b) => a + b, 0)

    if (keptMessages.length < nonSystemMsgs.length) {
      const trimmedCount = nonSystemMsgs.length - keptMessages.length
      console.warn(
        `[ai-client] Context trimmed for ${provider}/${model}: ` +
        `~${totalBefore} est. tokens → removed ${trimmedCount} old message(s) ` +
        `to stay within ${contextLimit} token limit`,
      )
      effectiveMessages = [...systemMsgs, ...keptMessages]
    }
  }

  // 5. Route to provider with retry on 429
  // Kimi (Moonshot) Tier 0 accounts have ~3 RPM total.
  // Retrying on 429 burns the entire per-minute quota.
  // Pass maxAttempts=1 to surface errors immediately.
  const maxRetryAttempts = provider === 'kimi' ? 1 : 3
  return withRetry(async () => {
    // Anthropic — own SDK
    if (provider === 'anthropic') {
      return callAnthropic({
        apiKey, model, messages: effectiveMessages, stream, max_tokens,
      })
    }

    // Gemini — own REST format
    if (provider === 'gemini') {
      return callGemini({
        apiKey,
        model,
        messages: effectiveMessages,
        stream,
        temperature,
        max_tokens,
      })
    }

    // MiniMax — own endpoint path
    if (provider === 'minimax') {
      return callMinimax({
        apiKey, model, messages: effectiveMessages,
        stream, temperature, max_tokens,
      })
    }

    // OpenRouter — needs extra HTTP headers
    if (provider === 'openrouter') {
      const res = await callOpenAICompat({
        baseUrl: PROVIDER_BASE.openrouter,
        apiKey,
        model,
        messages: effectiveMessages,
        stream,
        temperature,
        max_tokens,
        extraHeaders: {
          'HTTP-Referer':
            process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
          'X-Title': 'Reminisce',
        },
        provider: 'openrouter'
      })
      if (stream) return res
      return res.json()
    }

    // All other providers — pure OpenAI-compat (groq, cerebras, sambanova,
    // mistral, openai, kimi)
    const res = await callOpenAICompat({
      baseUrl: PROVIDER_BASE[provider],
      apiKey,
      model,
      messages: effectiveMessages,
      stream,
      temperature,
      max_tokens,
      provider
    })
    if (stream) return res
    return res.json()
  }, maxRetryAttempts)
}

// ─────────────────────────────────────────────────────
//  Helper: does this user have their own key?
// ─────────────────────────────────────────────────────

export async function userHasOwnKey(
  userId: string,
  provider: string,
): Promise<boolean> {
  try {
    const supabase = getServiceSupabase()
    const { data } = await supabase
      .from('user_api_keys')
      .select('encrypted_key')
      .eq('user_id', userId)
      .eq('provider', provider)
      .single()
    if (!data?.encrypted_key) return false
    return decrypt(data.encrypted_key).length > 0
  } catch {
    return false
  }
}
