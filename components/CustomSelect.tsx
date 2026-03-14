'use client'

import { useState, useRef, useEffect } from 'react'
import { useTheme } from '@/hooks/useTheme'

interface SelectOption {
  value: string
  label: string
  color?: string
}

interface CustomSelectProps {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  width?: number | string
  compact?: boolean
}

function hexToRgba(hex: string, a: number) {
  const r = parseInt(hex.slice(1,3),16)
  const g = parseInt(hex.slice(3,5),16)
  const b = parseInt(hex.slice(5,7),16)
  return `rgba(${r},${g},${b},${a})`
}

export default function CustomSelect({
  value, onChange, options,
  placeholder = 'Select...',
  width = 'auto',
  compact = false,
}: CustomSelectProps) {
  const { accent } = useTheme()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && 
          !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => 
      document.removeEventListener('mousedown', handler)
  }, [])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => 
      window.removeEventListener('keydown', handler)
  }, [])

  const selected = options.find(o => o.value === value)
  const displayLabel = selected?.label || placeholder
  const displayColor = selected?.color

  const padding = compact 
    ? '5px 10px' : '8px 12px'
  const fontSize = compact ? 11 : 12

  return (
    <div 
      ref={ref}
      style={{ 
        position: 'relative', 
        width,
        userSelect: 'none',
      }}
    >
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding,
          background: open
            ? 'rgba(255,255,255,0.07)'
            : 'rgba(255,255,255,0.05)',
          border: `1px solid ${open 
            ? hexToRgba(accent, 0.4)
            : 'rgba(255,255,255,0.1)'}`,
          borderRadius: 8,
          cursor: 'pointer',
          transition: 'all 0.15s',
          outline: 'none',
          minWidth: 0,
        }}
      >
        <span style={{
          fontSize,
          fontWeight: 600,
          color: displayColor || '#fff',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
          textAlign: 'left',
        }}>
          {displayLabel}
        </span>
        <span style={{
          fontSize: 8,
          color: 'rgba(255,255,255,0.3)',
          flexShrink: 0,
          transition: 'transform 0.15s',
          display: 'inline-block',
          transform: open 
            ? 'rotate(180deg)' 
            : 'rotate(0deg)',
        }}>
          ▾
        </span>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          left: 0,
          minWidth: '100%',
          background: '#111',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 10,
          zIndex: 200,
          overflow: 'hidden',
          boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
          maxHeight: 280,
          overflowY: 'auto',
        }}>
          {options.map(option => {
            const isActive = option.value === value
            return (
              <div
                key={option.value}
                onClick={() => {
                  onChange(option.value)
                  setOpen(false)
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  padding: compact 
                    ? '8px 12px' 
                    : '10px 14px',
                  cursor: 'pointer',
                  background: isActive
                    ? hexToRgba(accent, 0.1)
                    : 'transparent',
                  borderBottom: 
                    '1px solid rgba(255,255,255,0.04)',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => {
                  if (!isActive) {
                    e.currentTarget.style.background = 
                      'rgba(255,255,255,0.06)'
                  }
                }}
                onMouseLeave={e => {
                  if (!isActive) {
                    e.currentTarget.style.background = 
                      'transparent'
                  }
                }}
              >
                <span style={{
                  fontSize,
                  fontWeight: isActive ? 700 : 400,
                  color: option.color 
                    || (isActive ? '#fff' : 'rgba(255,255,255,0.7)'),
                }}>
                  {option.label}
                </span>
                {isActive && (
                  <span style={{
                    fontSize: 10,
                    color: accent,
                    flexShrink: 0,
                  }}>
                    ✓
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
