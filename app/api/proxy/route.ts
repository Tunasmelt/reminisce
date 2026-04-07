import { NextResponse } from 'next/server'
import { supabase as clientSupabase } from '@/lib/supabase'

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await clientSupabase.auth.getUser(token)
    if (!user || authError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { url, method, headers, body, authType, authValue } = await req.json()

    if (!url || !method) {
      return NextResponse.json({ error: 'Missing URL or Method' }, { status: 400 })
    }

    // ── SSRF protection ─────────────────────────────────────────────────────
    // Block private/internal network addresses and non-HTTPS schemes
    let parsedUrl: URL
    try {
      parsedUrl = new URL(url)
    } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return NextResponse.json({ error: 'Only HTTP/HTTPS URLs are allowed' }, { status: 400 })
    }

    const hostname = parsedUrl.hostname.toLowerCase()
    const blockedPatterns = [
      /^localhost$/,
      /^127\./,
      /^10\./,
      /^172\.(1[6-9]|2\d|3[01])\./,
      /^192\.168\./,
      /^169\.254\./,  // AWS metadata service
      /^::1$/,
      /^0\.0\.0\.0$/,
      /\.internal$/,
      /\.local$/,
    ]
    if (blockedPatterns.some(p => p.test(hostname))) {
      return NextResponse.json({ error: 'Private/internal URLs are not allowed' }, { status: 400 })
    }

    const fetchHeaders: Record<string, string> = { ...headers }

    if (authType === 'Bearer Token' && authValue) {
      fetchHeaders['Authorization'] = `Bearer ${authValue}`
    } else if (authType === 'API Key' && authValue) {
      fetchHeaders['x-api-key'] = authValue
    }

    const start = Date.now()
    let ttfb = 0

    try {
      const response = await fetch(url, {
        method,
        headers: fetchHeaders,
        body: method !== 'GET' ? body : undefined,
      })

      ttfb = Date.now() - start
      const responseText = await response.text()
      const totalTime = Date.now() - start

      return NextResponse.json({
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers),
        body: responseText,
        timing: {
          total: totalTime,
          ttfb: ttfb
        },
        size: responseText.length
      })
    } catch (fetchErr: unknown) {
      return NextResponse.json({ 
        error: fetchErr instanceof Error ? fetchErr.message : 'Network failure',
        status: 0,
        timing: { total: Date.now() - start, ttfb: 0 }
      }, { status: 500 })
    }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('Proxy error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
