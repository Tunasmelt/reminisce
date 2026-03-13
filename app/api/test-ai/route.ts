import { NextResponse } from 'next/server'
import { callAI } from '@/lib/ai-client'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const response = await callAI({
      userId: "test",
      provider: "openrouter",
      model: "mistralai/mistral-small-3.1-24b-instruct:free",
      messages: [{ role: "user", content: "Say hello in exactly 5 words" }],
      stream: false
    })
    
    return NextResponse.json(response)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
