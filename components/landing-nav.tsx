'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Star, Menu, X } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'

export default function LandingNav() {
  const { accent } = useTheme()
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    
    handleScroll()
    checkMobile()
    
    window.addEventListener('scroll', handleScroll)
    window.addEventListener('resize', checkMobile)
    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', checkMobile)
    }
  }, [])

  const linksList = [
    { name: 'CAPABILITIES', href: '/capabilities' },
    { name: 'ENGINEERING', href: '/engineering' },
    { name: 'DOCS', href: '/docs' }
  ]

  return (
    <>
      <nav 
        style={{
          position: 'fixed',
          top: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 50,
          width: isMobile ? 'calc(100% - 24px)' : 'calc(100% - 40px)',
          maxWidth: 680,
          margin: '0 auto',
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 999,
          padding: isMobile ? '8px 16px' : '10px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: scrolled ? '0 12px 40px rgba(0,0,0,0.5)' : 'none',
          transition: 'all 300ms cubic-bezier(0.19, 1, 0.22, 1)'
        }}
      >
        {/* Logo */}
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <Star size={16} fill={accent} stroke={accent} />
          {!isMobile && (
            <span style={{ color: '#fff', fontWeight: 800, fontSize: 13, fontStyle: 'italic', letterSpacing: '-0.02em', textTransform: 'uppercase' }}>
              Reminisce
            </span>
          )}
        </Link>
        
        {/* Links (Desktop) */}
        {!isMobile && (
          <div style={{ display: 'flex', gap: 24 }}>
            {linksList.map(link => {
              const isActive = pathname === link.href
              return (
                <Link 
                  key={link.href} 
                  href={link.href} 
                  style={{ 
                    fontSize: 11, 
                    fontWeight: 700, 
                    letterSpacing: '0.12em', 
                    textTransform: 'uppercase',
                    color: isActive ? accent : 'rgba(255,255,255,0.5)', 
                    textDecoration: 'none',
                    transition: '150ms',
                    borderBottom: isActive ? `1px solid ${accent}` : 'none',
                    padding: '4px 0'
                  }}
                  onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.color = 'rgba(255,255,255,0.9)' }}
                  onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.color = 'rgba(255,255,255,0.5)' }}
                >
                  {link.name}
                </Link>
              )
            })}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 16 }}>
          {/* Button */}
          <Link 
            href="/dashboard"
            style={{
              background: accent,
              color: '#000',
              borderRadius: 999,
              padding: isMobile ? '7px 14px' : '8px 20px',
              fontSize: isMobile ? 10 : 12,
              fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              textDecoration: 'none',
              transition: 'all 200ms cubic-bezier(0.19, 1, 0.22, 1)'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            {isMobile ? 'LAUNCH' : 'Launch Workspace →'}
          </Link>

          {isMobile && (
            <button 
              onClick={() => setMenuOpen(!menuOpen)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
                padding: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          )}
        </div>
      </nav>

      {/* Mobile Menu */}
      {isMobile && menuOpen && (
        <div style={{
          position: 'fixed',
          top: 74,
          left: 12,
          right: 12,
          background: 'rgba(0,0,0,0.95)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 16,
          padding: 20,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          zIndex: 49,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          animation: 'pageEnter 0.2s ease-out both'
        }}>
          {linksList.map(link => {
            const isActive = pathname === link.href
            return (
              <Link 
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                style={{
                  padding: '12px 16px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  color: isActive ? accent : 'rgba(255,255,255,0.6)',
                  textDecoration: 'none',
                  background: isActive ? 'rgba(255,255,255,0.06)' : 'transparent',
                  transition: 'all 0.15s ease'
                }}
              >
                {link.name}
              </Link>
            )
          })}
        </div>
      )}
    </>
  )
}
