import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Only gate the /admin/* routes
  if (!pathname.startsWith('/admin')) {
    return NextResponse.next()
  }

  // The actual admin check happens in the API routes and the page itself
  // using the DB is_admin flag. The middleware just ensures the session
  // cookie exists at all — no Supabase call here (edge-safe).
  const hasSession =
    request.cookies.has('sb-access-token') ||
    request.cookies.has('sb-auth-token') ||
    // Supabase SSR cookie name varies by version
    request.cookies.getAll().some(c => c.name.startsWith('sb-') && c.name.endsWith('-auth-token'))

  if (!hasSession) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', '/admin')
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*'],
}
