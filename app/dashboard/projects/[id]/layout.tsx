'use client'

import { useState, useEffect } from 'react'
import { useParams, usePathname } from 'next/navigation'
import Link from 'next/link'
import { Settings } from 'lucide-react'
import ThemeToggle from '@/components/theme-toggle'
import { useTheme } from '@/hooks/useTheme'
import { supabase } from '@/lib/supabase'

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const params = useParams()
  const pathname = usePathname()
  const { accent } = useTheme()
  const projectId = params.id as string
  const [projectName, setProjectName] = useState('')
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    supabase.from('projects').select('name').eq('id', projectId).single()
      .then(({ data }) => setProjectName(data?.name || ''))
    
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [projectId])

  const navItems = [
    { label: 'Overview', href: `/dashboard/projects/${projectId}` },
    { label: 'Wizard', href: `/dashboard/projects/${projectId}/wizard` },
    { label: 'Context', href: `/dashboard/projects/${projectId}/context` },
    { label: 'Graph', href: `/dashboard/projects/${projectId}/graph` },
    { label: 'Prompts', href: `/dashboard/projects/${projectId}/prompts` },
    { label: 'Agent', href: `/dashboard/projects/${projectId}/agent` },
    { label: 'API Lab', href: `/dashboard/projects/${projectId}/api-lab` },
    { label: 'Settings', href: `/dashboard/projects/${projectId}/settings` },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#000' }}>
      {/* PROJECT HEADER */}
      <header style={{
        position: 'fixed',
        top: 56,
        left: 0,
        right: 0,
        height: 48,
        background: 'rgba(0,0,0,0.9)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        zIndex: 30,
        padding: isMobile ? '0 12px' : '0 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <Link href="/dashboard" style={{ color: accent, fontSize: 10, fontWeight: 700, textDecoration: 'none', letterSpacing: '0.05em' }}>
            {isMobile ? '←' : 'REMINISCE'}
          </Link>
          {!isMobile && (
            <>
              <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10 }}>›</span>
              <span style={{ 
                color: 'rgba(255,255,255,0.6)', 
                fontSize: 10, 
                fontWeight: 700, 
                textTransform: 'uppercase', 
                letterSpacing: '0.08em',
                maxWidth: 120,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {projectName || 'DOM_ID'}
              </span>
            </>
          )}
        </div>

        {/* Center Nav Tabs */}
        <nav 
          style={{ 
            display: 'flex', 
            gap: 0, 
            position: isMobile ? 'static' : 'absolute', 
            left: isMobile ? 'auto' : '50%', 
            transform: isMobile ? 'none' : 'translateX(-50%)',
            overflowX: 'auto',
            paddingRight: isMobile ? 12 : 0,
            paddingLeft: isMobile ? 12 : 0,
            WebkitOverflowScrolling: 'touch'
          }} 
          className="hide-scrollbar"
        >
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.label}
                href={item.href}
                style={{
                  padding: isMobile ? '14px 12px' : '14px 16px',
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  border: 'none',
                  background: 'transparent',
                  borderBottom: `2px solid ${isActive ? accent : 'transparent'}`,
                  color: isActive ? accent : 'rgba(255,255,255,0.35)',
                  textDecoration: 'none',
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap',
                  minWidth: 'max-content'
                }}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        {!isMobile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
            <ThemeToggle />
            <Link href={`/dashboard/projects/${projectId}/settings`} style={{ display: 'flex', alignItems: 'center' }}>
              <Settings 
                size={16} 
                style={{ 
                  color: pathname.includes('/settings') ? accent : 'rgba(255,255,255,0.3)',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => { if (!pathname.includes('/settings')) e.currentTarget.style.color = accent }}
                onMouseLeave={(e) => { if (!pathname.includes('/settings')) e.currentTarget.style.color = 'rgba(255,255,255,0.3)' }}
              />
            </Link>
          </div>
        )}
      </header>
      
      <main style={{ paddingTop: 104 }}>
        {children}
      </main>
    </div>
  )
}
