/**
 * lib/stream-parser.ts
 *
 * Unified SSE stream reader for all AI provider responses.
 * Used by: app/dashboard/projects/[id]/agent/page.tsx (PAM)
 *          app/dashboard/projects/[id]/wizard/page.tsx (Wizard chat)
 *
 * Handles:
 *  - OpenAI/OpenRouter/Groq/Cerebras/SambaNova SSE format
 *  - [DONE] termination
 *  - Partial chunk buffering (chunks may split across lines)
 *  - Custom meta events (__pam_action, __wizard_meta)
 *  - [PAM_ACTION]...[/PAM_ACTION] block stripping from live text
 */

export interface StreamChunk {
  /** Decoded text delta from choices[0].delta.content */
  delta:    string
  /** Raw parsed JSON — for custom meta events */
  raw:      Record<string, unknown>
  /** True if this chunk is a custom meta event (not a text delta) */
  isMeta:   boolean
}

/**
 * Reads an SSE ReadableStream and yields parsed chunks.
 * Buffers partial lines correctly so split chunks never cause parse errors.
 *
 * Usage:
 *   for await (const chunk of readSSEStream(res.body)) {
 *     if (!chunk.isMeta) accumulatedText += chunk.delta
 *   }
 */
export async function* readSSEStream(
  body: ReadableStream<Uint8Array>
): AsyncGenerator<StreamChunk> {
  const reader  = body.getReader()
  const decoder = new TextDecoder()
  let   buffer  = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      // Keep the last (potentially incomplete) line in the buffer
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data: ')) continue
        const data = trimmed.slice(6)
        if (data === '[DONE]') continue

        try {
          const parsed = JSON.parse(data) as Record<string, unknown>
          const delta  = (
            (parsed?.choices as Array<{ delta?: { content?: string } }>)?.[0]
              ?.delta?.content
          ) ?? ''

          // Is this a custom meta event (no text delta)?
          const isMeta = !delta && Object.keys(parsed).some(k =>
            k.startsWith('__') || k === 'type'
          )

          yield { delta, raw: parsed, isMeta }
        } catch {
          // Partial / malformed chunk — skip silently
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

/**
 * Strips [PAM_ACTION]...[/PAM_ACTION] blocks from a live streaming string.
 * Call this on every accumulated text update before rendering.
 */
export function stripPamAction(text: string): string {
  return text.replace(/\[PAM_ACTION\][\s\S]*?\[\/PAM_ACTION\]/g, '').trim()
}

/**
 * Rough token estimator — chars / 4.
 * Good enough for UI indicators. Not billing-accurate.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}
