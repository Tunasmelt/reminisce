'use client'

import { useState, useEffect } from 'react'
import { ProtectedRoute } from '@/components/protected-route'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Star, LogOut } from 'lucide-react'
import ThemeToggle from '@/components/theme-toggle'
import { useTheme } from '@/hooks/useTheme'
import { User } from '@supabase/supabase-js'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { accent } = useTheme()
  const [user, setUser] = useState<User | null>(null)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const userInitial = user?.email?.[0]?.toUpperCase() || '?'

  return (
    <ProtectedRoute>
      <div style={{ minHeight: '100vh', background: '#000', color: '#fff' }}>
        <header style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 40,
          height: 56,
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          padding: isMobile ? '0 16px' : '0 32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          {/* Left: Logo */}
          <Link href="/dashboard" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Star size={14} fill={accent} stroke={accent} />
            <span style={{ 
              fontSize: 13, 
              fontWeight: 800, 
              letterSpacing: '0.15em', 
              textTransform: 'uppercase', 
              color: '#fff' 
            }}>
              {isMobile ? '★' : 'REMINISCE'}
            </span>
          </Link>

          {/* Right: Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 12 : 16 }}>
            <ThemeToggle />
            
            <div style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: `rgba(${parseInt(accent.slice(1,3),16)},${parseInt(accent.slice(3,5),16)},${parseInt(accent.slice(5,7),16)}, 0.15)`,
              border: `1px solid rgba(${parseInt(accent.slice(1,3),16)},${parseInt(accent.slice(3,5),16)},${parseInt(accent.slice(5,7),16)}, 0.3)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              fontWeight: 700,
              color: accent
            }}>
              {userInitial}
            </div>

            <button 
              onClick={handleLogout}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 6,
                padding: isMobile ? '6px' : '6px 12px',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.4)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#fff'
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'rgba(255,255,255,0.4)'
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
              }}
            >
              {isMobile ? <LogOut size={14} /> : 'Sign Out'}
            </button>
          </div>
        </header>
        
        <main style={{ paddingTop: 56, minHeight: '100vh' }}>
          {children}
        </main>
      </div>
    </ProtectedRoute>
  )
}
