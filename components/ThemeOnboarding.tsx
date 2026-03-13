'use client'

import { useState } from 'react'
import { themes, useTheme, THEME_COLORS } from '@/hooks/useTheme'
import { Flame, Sparkles, Moon, Leaf, Terminal } from 'lucide-react'

const ICONS: Record<string, React.ReactNode> = {
  flame:    <Flame size={20} />,
  sparkles: <Sparkles size={20} />,
  moon:     <Moon size={20} />,
  leaf:     <Leaf size={20} />,
  terminal: <Terminal size={20} />,
}

export default function ThemeOnboarding() {
  const { applyTheme } = useTheme()
  const [selected, setSelected] = useState('solar-flare')
  const [hovering, setHovering] = useState<string | null>(null)

  const active = hovering || selected
  const activeColor = THEME_COLORS[active]

  const handleEnter = () => {
    applyTheme(selected, true)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: '#000',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 0,
    }}>
      {/* Animated accent glow behind content */}
      <div style={{
        position: 'absolute',
        width: 600, height: 600,
        borderRadius: '50%',
        background: activeColor,
        opacity: 0.04,
        filter: 'blur(120px)',
        transition: 'background 0.4s ease',
        pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', textAlign: 'center', 
                    maxWidth: 560, padding: '0 24px' }}>
        
        {/* Logo */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          marginBottom: 48,
          fontSize: 13, fontWeight: 700, letterSpacing: '0.15em',
          textTransform: 'uppercase', color: '#fff',
        }}>
          <span style={{ color: activeColor, 
                         transition: 'color 0.3s' }}>★</span>
          REMINISCE
        </div>

        <h1 style={{
          fontSize: 'clamp(32px, 5vw, 52px)',
          fontWeight: 800,
          letterSpacing: '-0.03em',
          lineHeight: 1.1,
          color: '#fff',
          marginBottom: 16,
        }}>
          Choose your frequency.
        </h1>

        <p style={{
          fontSize: 15, color: 'rgba(255,255,255,0.45)',
          marginBottom: 56, lineHeight: 1.6,
        }}>
          Your workspace. Your aesthetic. 
          Change it anytime from settings.
        </p>

        {/* Theme cards */}
        <div style={{
          display: 'flex', gap: 12,
          justifyContent: 'center',
          flexWrap: 'wrap',
          marginBottom: 48,
        }}>
          {themes.map(t => {
            const isActive = selected === t.id
            return (
              <button
                key={t.id}
                onClick={() => setSelected(t.id)}
                onMouseEnter={() => setHovering(t.id)}
                onMouseLeave={() => setHovering(null)}
                style={{
                  width: 96, height: 96,
                  borderRadius: 16,
                  border: `2px solid ${isActive 
                    ? t.color 
                    : 'rgba(255,255,255,0.08)'}`,
                  background: isActive 
                    ? `rgba(${THEME_COLORS[t.id] === '#f59e0b' 
                        ? '245,158,11' : t.id === 'elite-purple' 
                        ? '139,92,246' : t.id === 'midnight-cyan'
                        ? '6,182,212' : t.id === 'emerald-circuit'
                        ? '16,185,129' : '228,228,231'}, 0.08)`
                    : 'rgba(255,255,255,0.03)',
                  cursor: 'pointer',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  gap: 8,
                  transition: 'all 0.2s ease',
                  transform: isActive ? 'scale(1.05)' : 'scale(1)',
                }}
              >
                <div style={{ color: t.color }}>
                  {ICONS[t.icon]}
                </div>
                <span style={{
                  fontSize: 10, fontWeight: 700,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: isActive 
                    ? '#fff' 
                    : 'rgba(255,255,255,0.4)',
                  transition: 'color 0.2s',
                }}>
                  {t.name.split(' ')[0]}
                </span>
              </button>
            )
          })}
        </div>

        {/* Description of selected */}
        <p style={{
          fontSize: 13, 
          color: activeColor,
          marginBottom: 40,
          minHeight: 20,
          transition: 'color 0.3s',
          letterSpacing: '0.05em',
        }}>
          {themes.find(t => t.id === active)?.description}
        </p>

        {/* Enter button */}
        <button
          onClick={handleEnter}
          style={{
            padding: '16px 48px',
            borderRadius: 999,
            background: activeColor,
            color: '#000',
            fontSize: 13, fontWeight: 800,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            border: 'none', cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={e => {
            (e.target as HTMLButtonElement).style.transform 
              = 'scale(1.04)'
          }}
          onMouseLeave={e => {
            (e.target as HTMLButtonElement).style.transform 
              = 'scale(1)'
          }}
        >
          Enter workspace →
        </button>
      </div>
    </div>
  )
}
