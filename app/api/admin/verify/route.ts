import { NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const check = await verifyAdmin(req.headers.get('authorization'))
  if (!check.ok) return check.response
  return NextResponse.json({ admin: true, userId: check.userId })
}
