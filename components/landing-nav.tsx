'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import ReminisceLogo from '@/components/ReminisceLogo'
import { supabase } from '@/lib/supabase'

function hexToRgba(hex: string, a: number) {
  if (!hex || hex.length < 7) return `rgba(245,158,11,${a})`
  const r = parseInt(hex.slice(1,3),16)
  const g = parseInt(hex.slice(3,5),16)
  const b = parseInt(hex.slice(5,7),16)
  return `rgba(${r},${g},${b},${a})`
}

export default function LandingNav() {
  const { accent } = useTheme()
  const ac = accent || '#f59e0b'
  const pathname = usePathname()
  const [scrolled, setScrolled]   = useState(false)
  const [progress, setProgress]   = useState(0)
  const [menuOpen, setMenuOpen]   = useState(false)
  const [mobile, setMobile]       = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setIsLoggedIn(!!data.user)
    })
    // Listen for auth changes (login/logout while page is open)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => setIsLoggedIn(!!session)
    )
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const resize = () => setMobile(window.innerWidth < 768)
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 20)
      const doc = document.documentElement
      setProgress(window.scrollY / (doc.scrollHeight - doc.clientHeight) || 0)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => { setMenuOpen(false) }, [pathname])

  const links = [
    { name: 'Features', href: '/capabilities' },
    { name: 'How it works', href: '/engineering' },
    { name: 'Docs', href: '/docs' },
    { name: 'Pricing', href: '/upgrade' },
  ]

  const isActive = (href: string) => pathname === href

  return (
    <>
      <nav style={{
        position: 'fixed', top: 16, left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 100,
        width: 'max-content',
        maxWidth: mobile ? 'calc(100% - 24px)' : 'calc(100% - 80px)',
        minWidth: mobile ? undefined : 480,
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
        gap: mobile ? 8 : 28,
        padding: mobile ? '8px 14px' : '10px 20px',
        background: scrolled ? 'rgba(5,5,16,0.94)' : 'rgba(5,5,16,0.75)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: scrolled
          ? '1px solid rgba(255,255,255,0.1)'
          : '1px solid rgba(255,255,255,0.07)',
        borderRadius: 999,
        boxShadow: scrolled ? '0 12px 40px rgba(0,0,0,0.45)' : 'none',
        transition: 'all 0.3s cubic-bezier(0.19,1,0.22,1)',
      }}>

        {/* Logo */}
        <Link href="/" style={{
          display: 'flex', alignItems: 'center',
          gap: 9, textDecoration: 'none', flexShrink: 0,
        }}>
          <ReminisceLogo size={22} color="#ffffff" />
          {!mobile && (
            <span style={{
              color: '#fff', fontWeight: 700, fontSize: 15,
              letterSpacing: '0.01em',
            }}>
              Reminisce
            </span>
          )}
        </Link>

        {/* Desktop links */}
        {!mobile && (
          <div style={{ display: 'flex', gap: 4 }}>
            {links.map(({ name, href }) => (
              <Link key={href} href={href} style={{
                padding: '5px 13px', borderRadius: 999,
                fontSize: 11, fontWeight: 700,
                textTransform: 'none' as const,
                letterSpacing: '0.01em',
                color: isActive(href) ? ac : 'rgba(255,255,255,0.48)',
                textDecoration: 'none',
                background: isActive(href) ? hexToRgba(ac, 0.1) : 'transparent',
                border: isActive(href)
                  ? `1px solid ${hexToRgba(ac, 0.25)}`
                  : '1px solid transparent',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                if (!isActive(href))
                  (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.88)'
              }}
              onMouseLeave={e => {
                if (!isActive(href))
                  (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.48)'
              }}
              >
                {name}
              </Link>
            ))}
          </div>
        )}

        {/* CTA group */}
        <div style={{
          display: 'flex', alignItems: 'center',
          gap: 8, flexShrink: 0,
        }}>
          {!mobile && !isLoggedIn && (
            <Link href="/login" style={{
              fontSize: 11, fontWeight: 700,
              textTransform: 'none' as const,
              letterSpacing: '0.01em',
              color: 'rgba(255,255,255,0.4)',
              textDecoration: 'none',
              padding: '5px 12px',
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#fff'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.4)'}
            >
              Sign in
            </Link>
          )}

          <Link href="/dashboard" style={{
            background: ac,
            color: '#000',
            borderRadius: 999,
            padding: mobile ? '7px 13px' : '8px 18px',
            fontSize: mobile ? 10 : 11,
            fontWeight: 800,
            textTransform: 'none' as const,
            letterSpacing: '0.01em',
            textDecoration: 'none',
            boxShadow: `0 0 20px ${hexToRgba(ac, 0.35)}`,
            transition: 'opacity 0.15s',
            whiteSpace: 'nowrap' as const,
          }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.84'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
          >
            {mobile ? 'Open' : 'Go to app →'}
          </Link>

          {mobile && (
            <button
              onClick={() => setMenuOpen(v => !v)}
              style={{
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10, width: 34, height: 34,
                display: 'flex', alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer', color: '#fff',
              }}
            >
              {menuOpen ? <X size={15}/> : <Menu size={15}/>}
            </button>
          )}
        </div>
      </nav>

      {/* Scroll progress bar — only visible once user starts scrolling */}
      {progress > 0.01 && (
        <div style={{
          position: 'fixed', top: 0, left: 0,
          height: 2, zIndex: 99,
          width: `${Math.min(progress, 1) * 100}%`,
          background: `linear-gradient(to right, transparent 0%, ${hexToRgba(ac, 0.6)} 20%, ${ac} 100%)`,
          transition: 'width 0.12s linear',
          pointerEvents: 'none',
          borderRadius: '0 2px 2px 0',
        }}/>
      )}

      {/* Mobile drawer */}
      <div style={{
        position: 'fixed', top: 72, left: 12, right: 12,
        zIndex: 99,
        background: 'rgba(5,5,16,0.97)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: menuOpen ? '1px solid rgba(255,255,255,0.09)' : '1px solid transparent',
        borderRadius: 20,
        padding: menuOpen ? '20px 20px 24px' : '0 20px',
        maxHeight: menuOpen ? 320 : 0,
        overflow: 'hidden',
        transition: 'max-height 0.3s cubic-bezier(0.19,1,0.22,1), padding 0.3s ease, border-color 0.3s ease',
        pointerEvents: menuOpen ? 'auto' : 'none',
      }}>
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          {links.map(({ name, href }) => (
            <Link key={href} href={href} style={{
              padding: '12px 16px', borderRadius: 12,
              fontSize: 14, fontWeight: isActive(href) ? 700 : 400,
              color: isActive(href) ? '#fff' : 'rgba(255,255,255,0.55)',
              textDecoration: 'none',
              background: isActive(href) ? hexToRgba(ac, 0.1) : 'transparent',
              border: isActive(href)
                ? `1px solid ${hexToRgba(ac, 0.2)}`
                : '1px solid transparent',
            }}>
              {name}
            </Link>
          ))}
          {!isLoggedIn && (
            <Link href="/login" style={{
              padding: '12px 16px', borderRadius: 12,
              fontSize: 14, color: 'rgba(255,255,255,0.5)',
              textDecoration: 'none',
            }}>
              Sign in
            </Link>
          )}
        </div>
      </div>
    </>
  )
}
