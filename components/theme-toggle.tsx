'use client'

import { useState, useEffect, useRef } from 'react'
import { useTheme } from '@/hooks/useTheme'
import { Check } from 'lucide-react'

export default function ThemeToggle() {
  const { theme, accent, applyTheme, themes } = useTheme()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.15s ease',
          outline: 'none'
        }}
        onMouseEnter={(e) => e.currentTarget.style.borderColor = `rgba(255,255,255,0.2)`}
        onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}
      >
        <div style={{
          width: 12,
          height: 12,
          borderRadius: '50%',
          background: accent,
          boxShadow: `0 0 8px ${accent}66`,
          transition: 'all 0.2s ease'
        }} />
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          top: 44,
          right: 0,
          width: 220,
          background: 'rgba(10,10,10,0.95)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 12,
          padding: 8,
          backdropFilter: 'blur(20px)',
          zIndex: 100,
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
        }}>
          <div style={{
            padding: '8px 12px 12px',
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.3)'
          }}>
            VISUAL FREQUENCY
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {themes.map(t => {
              const isActive = theme === t.id
              return (
                <div
                  key={t.id}
                  onClick={() => {
                    applyTheme(t.id)
                    setOpen(false)
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 12px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    background: isActive ? `rgba(${parseInt(t.color.slice(1,3), 16)}, ${parseInt(t.color.slice(3,5), 16)}, ${parseInt(t.color.slice(5,7), 16)}, 0.08)` : 'transparent',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                  onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
                >
                  <div style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: t.color,
                    flexShrink: 0,
                    boxShadow: isActive ? `0 0 6px ${t.color}` : 'none'
                  }} />
                  <span style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: isActive ? '#fff' : 'rgba(255,255,255,0.5)',
                    transition: 'all 0.15s ease'
                  }}>
                    {t.name}
                  </span>
                  {isActive && (
                    <Check size={12} color={accent} style={{ marginLeft: 'auto' }} />
                  )}
                </div>
              )
            }
            )}
          </div>
        </div>
      )}
    </div>
  )
}
