'use client'

import React from 'react'
import { useTheme } from '@/hooks/useTheme'
import { Check } from 'lucide-react'

function hexToRgba(hex: string, a: number) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

export function ThemeSwitcher() {
  const { theme: currentTheme, accent, applyTheme, themes } = useTheme()

  return (
    <div style={{ width: '100%' }}>
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(5, 1fr)', 
        gap: 12,
        width: '100%'
      }}>
        {themes.map((t) => {
          const isActive = currentTheme === t.id
          return (
            <div
              key={t.id}
              onClick={() => applyTheme(t.id)}
              style={{
                border: `2px solid ${isActive ? t.color : 'rgba(255,255,255,0.06)'}`,
                borderRadius: 16,
                padding: '20px 16px',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.2s ease',
                background: isActive ? hexToRgba(t.color, 0.06) : 'rgba(255,255,255,0.02)',
                position: 'relative',
                transform: isActive ? 'scale(1.03)' : 'scale(1)',
                outline: 'none'
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.borderColor = hexToRgba(t.color, 0.3)
                  e.currentTarget.style.transform = 'scale(1.01)'
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'
                  e.currentTarget.style.transform = 'scale(1)'
                }
              }}
            >
              {isActive && (
                <div style={{ 
                  position: 'absolute', top: -6, right: -6, width: 18, height: 18, 
                  borderRadius: '50%', background: t.color, display: 'flex', 
                  alignItems: 'center', justifyContent: 'center', zIndex: 10
                }}>
                  <Check size={10} color="#000" strokeWidth={4} />
                </div>
              )}
              
              <div style={{ 
                width: 32, height: 32, borderRadius: '50%', background: t.color, 
                margin: '0 auto 12px',
                boxShadow: isActive 
                  ? `0 0 0 3px rgba(0,0,0,1), 0 0 0 5px ${t.color}, 0 0 16px ${t.color}66`
                  : `0 0 0 3px rgba(0,0,0,1), 0 0 0 4px ${hexToRgba(t.color, 0.2)}`
              }} />

              <div style={{ 
                fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', 
                textTransform: 'uppercase', color: isActive ? t.color : 'rgba(255,255,255,0.5)', 
                marginBottom: 4 
              }}>
                {t.name}
              </div>
              
              <div style={{ fontSize: 10, lineHeight: 1.5, color: 'rgba(255,255,255,0.25)' }}>
                {t.description}
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ 
        marginTop: 24, padding: '16px 20px', border: '1px solid rgba(255,255,255,0.06)', 
        borderRadius: 10, background: 'rgba(255,255,255,0.02)', display: 'flex', 
        alignItems: 'center', justifyContent: 'space-between' 
      }}>
        <div>
          <span style={{ fontSize: 10, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginRight: 12 }}>
            ACTIVE FREQUENCY:
          </span>
          <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: accent }}>
            {themes.find(t => t.id === currentTheme)?.name}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {themes.map(t => (
            <div key={t.id} style={{ 
              width: 10, height: 10, borderRadius: '50%', background: t.color,
              transform: currentTheme === t.id ? 'scale(1.4)' : 'scale(1)',
              boxShadow: currentTheme === t.id ? `0 0 6px ${t.color}` : 'none',
              transition: 'all 0.2s'
            }} />
          ))}
        </div>
      </div>
    </div>
  )
}
