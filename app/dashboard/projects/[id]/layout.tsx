'use client'

import { useState, useEffect } from 'react'
import { useParams, usePathname } from 'next/navigation'
import Link from 'next/link'
import { 
  LayoutDashboard, Wand2, 
  GitBranch, LayoutGrid, MessageSquare, Bot, 
  FlaskConical, Settings, ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import { supabase } from '@/lib/supabase'

function hexToRgba(hex: string, a: number) {
  const r = parseInt(hex.slice(1,3),16)
  const g = parseInt(hex.slice(3,5),16)
  const b = parseInt(hex.slice(5,7),16)
  return `rgba(${r},${g},${b},${a})`
}

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const params = useParams()
  const pathname = usePathname()
  const { accent } = useTheme()
  const projectId = params.id as string
  const [projectName, setProjectName] = useState('')
  const [pamReminderCount, setPamReminderCount] = useState(0)

  const [collapsed, setCollapsed] = useState(false)
  // Persist to localStorage
  useEffect(() => {
    const saved = localStorage.getItem(
      'reminisce-sidenav-collapsed'
    )
    if (saved === 'true') setCollapsed(true)
  }, [])

  const toggleCollapse = () => {
    setCollapsed((prev: boolean) => {
      localStorage.setItem(
        'reminisce-sidenav-collapsed', 
        String(!prev)
      )
      return !prev
    })
  }
  useEffect(() => {
    supabase.from('projects').select('name').eq('id', projectId).single()
      .then(({ data }) => setProjectName(data?.name || ''))

    // Load due reminder count for PAM badge
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return
      fetch(`/api/pam/reminders?projectId=${projectId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then(r => r.json())
        .then(data => {
          if (data.reminders) {
            // Count reminders due today or overdue
            const today = new Date().toISOString().split('T')[0]
            const due = data.reminders.filter(
              (r: { due_date: string | null }) =>
                !r.due_date || r.due_date <= today
            ).length
            setPamReminderCount(due)
          }
        })
        .catch(() => { /* non-fatal */ })
    })
  }, [projectId])

  const navItems = [
    { 
      label: 'Overview', icon: LayoutDashboard,
      href: `/dashboard/projects/${projectId}`
    },
    { 
      label: 'Wizard', icon: Wand2,
      href: `/dashboard/projects/${projectId}/wizard`
    },
    { 
      label: 'Graph', icon: GitBranch,
      href: `/dashboard/projects/${projectId}/graph`
    },
    { 
      label: 'Board', icon: LayoutGrid,
      href: `/dashboard/projects/${projectId}/board`
    },
    { 
      label: 'Prompts', icon: MessageSquare,
      href: `/dashboard/projects/${projectId}/prompts`
    },
    { 
      label: 'PAM', icon: Bot,
      href: `/dashboard/projects/${projectId}/agent`,
      badge: pamReminderCount,
    },
    { 
      label: 'API Lab', icon: FlaskConical,
      href: `/dashboard/projects/${projectId}/api-lab`
    },
    { 
      label: 'Settings', icon: Settings,
      href: `/dashboard/projects/${projectId}/settings`
    },
  ]

  const sidebarW = collapsed ? 52 : 220

  return (
    <div style={{
      display: 'flex',
      background: 'transparent',
    }}>
      
      {/* SIDEBAR */}
      <aside style={{
        position: 'fixed',
        top: 68,
        left: 0,
        bottom: 0,
        width: sidebarW,
        height: 'calc(100vh - 68px)',
        background: 'rgba(8,8,20,0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRight: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 30,
        transition: 'width 0.2s ease',
        overflow: 'hidden',
      }}>
        
        {/* Project name + breadcrumb */}
        <div style={{
          padding: collapsed ? '14px 0' : '16px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          justifyContent: collapsed ? 'center' : 'flex-start',
          minHeight: 56,
          flexShrink: 0,
        }}>
          {!collapsed && (
            <div style={{ flex: 1, minWidth: 0 }}>
              <Link
                href="/dashboard"
                style={{
                  fontSize: 10,
                  color: 'rgba(255,255,255,0.3)',
                  textDecoration: 'none',
                  letterSpacing: '0.02em',
                  display: 'block',
                  marginBottom: 3,
                  transition: 'color 0.15s',
                }}
                onMouseEnter={(e: React.MouseEvent) => 
                  ((e.currentTarget as HTMLElement).style.color = '#fff')
                }
                onMouseLeave={(e: React.MouseEvent) => 
                  ((e.currentTarget as HTMLElement).style.color = 
                    'rgba(255,255,255,0.3)')
                }
              >
                ← Projects
              </Link>
              <div style={{
                fontSize: 13, fontWeight: 600,
                color: '#fff',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {projectName || '...'}
              </div>
            </div>
          )}
          {collapsed && (
            <div style={{
              width: 28, height: 28,
              borderRadius: 8,
              background: hexToRgba(accent, 0.12),
              border: `1px solid ${hexToRgba(accent, 0.3)}`,
              display: 'flex', alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12, fontWeight: 700,
              color: accent,
              flexShrink: 0,
            }}>
              {projectName?.[0]?.toUpperCase() || 'P'}
            </div>
          )}
        </div>

        {/* Nav items */}
        <nav style={{
          flex: 1, overflowY: 'auto',
          padding: collapsed ? '8px 0' : '8px',
        }}>
          {navItems.map(item => {
            const Icon = item.icon
            const isActive = pathname === item.href
              || (item.href !== `/dashboard/projects/${projectId}`
                  && pathname.startsWith(item.href))
            
            return (
              <Link
                key={item.label}
                href={item.href}
                title={collapsed ? item.label : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: collapsed ? 0 : 10,
                  position: 'relative',
                  padding: collapsed 
                    ? '10px 0' 
                    : '9px 12px',
                  justifyContent: collapsed 
                    ? 'center' : 'flex-start',
                  borderRadius: collapsed ? 0 : 8,
                  marginBottom: 2,
                  background: isActive
                    ? hexToRgba(accent, 0.12)
                    : 'transparent',
                  boxShadow: isActive
                    ? `inset 0 0 0 1px ${hexToRgba(accent, 0.15)}`
                    : 'none',
                  borderLeft: collapsed 
                    ? `2px solid ${isActive 
                        ? accent 
                        : 'transparent'}`
                    : 'none',
                  color: isActive
                    ? accent
                    : 'rgba(255,255,255,0.45)',
                  textDecoration: 'none',
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 400,
                  transition: 'all 0.15s',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                }}
                onMouseEnter={(e: React.MouseEvent) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.background 
                      = 'rgba(255,255,255,0.06)';
                    (e.currentTarget as HTMLElement).style.color = '#fff'
                  }
                }}
                onMouseLeave={(e: React.MouseEvent) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.background 
                      = 'transparent';
                    (e.currentTarget as HTMLElement).style.color 
                      = 'rgba(255,255,255,0.45)'
                  }
                }}
              >
                <Icon 
                  size={16} 
                  style={{ flexShrink: 0 }}
                />
                {(item as { label: string; icon: React.ElementType; href: string; badge?: number }).badge ? (
                  <div style={{
                    position: 'absolute',
                    top: collapsed ? 6 : 4,
                    right: collapsed ? 6 : 4,
                    width: 7, height: 7,
                    borderRadius: '50%',
                    background: '#ef4444',
                    border: '1.5px solid #07070f',
                    flexShrink: 0,
                  }}/>
                ) : null}
                {!collapsed && item.label}
              </Link>
            )
          })}
        </nav>

        {/* Collapse button only — ThemeToggle removed from sidebar */}
        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.06)',
          padding: collapsed ? '8px 0' : '8px',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
        }}>
          <button
            onClick={toggleCollapse}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: collapsed 
                ? 'center' : 'flex-start',
              gap: 8,
              padding: collapsed ? '8px' : '8px 12px',
              background: 'transparent',
              border: 'none',
              borderRadius: 8,
              color: 'rgba(255,255,255,0.25)',
              cursor: 'pointer',
              fontSize: 12,
              transition: 'all 0.15s',
              width: collapsed ? 36 : '100%',
              alignSelf: collapsed ? 'center' : 'auto',
            }}
            onMouseEnter={(e: React.MouseEvent) => {
              (e.currentTarget as HTMLElement).style.color = '#fff';
              (e.currentTarget as HTMLElement).style.background 
                = 'rgba(255,255,255,0.06)'
            }}
            onMouseLeave={(e: React.MouseEvent) => {
              (e.currentTarget as HTMLElement).style.color 
                = 'rgba(255,255,255,0.25)';
              (e.currentTarget as HTMLElement).style.background 
                = 'transparent'
            }}
          >
            {collapsed 
              ? <ChevronRight size={14} />
              : <>
                  <ChevronLeft size={14} />
                  Collapse
                </>
            }
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main style={{
        marginLeft: sidebarW,
        transition: 'margin-left 0.2s ease',
        flex: 1,
        minWidth: 0,
        overflow: 'auto',
      }}>
        {children}
      </main>
    </div>
  )
}
