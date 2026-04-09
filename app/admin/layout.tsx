'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router  = useRouter()
  const [ready, setReady] = useState(false)
  const [denied, setDenied] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.replace('/login?redirect=/admin')
        return
      }
      // Verify admin status via API (checks DB is_admin flag)
      const res = await fetch('/api/admin/verify', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) {
        setDenied(true)
        return
      }
      setReady(true)
    })
  }, [router])

  if (denied) return (
    <div style={{
      height: '100vh', background: '#07070f',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: 16, color: '#fff',
    }}>
      <div style={{ fontSize: 48 }}>🔒</div>
      <div style={{ fontSize: 18, fontWeight: 700 }}>Access Denied</div>
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
        You do not have admin privileges.
      </div>
      <button
        onClick={() => router.push('/dashboard')}
        style={{
          marginTop: 8, padding: '10px 24px',
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 10, color: '#fff',
          cursor: 'pointer', fontSize: 13,
        }}
      >
        Go to Dashboard
      </button>
    </div>
  )

  if (!ready) return (
    <div style={{
      height: '100vh', background: '#07070f',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
        Verifying access…
      </div>
    </div>
  )

  return <>{children}</>
}
