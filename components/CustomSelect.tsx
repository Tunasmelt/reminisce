'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
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
  if (!hex || hex.length < 7) return `rgba(245,158,11,${a})`
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

export default function CustomSelect({
  value, onChange, options,
  placeholder = 'Select...',
  width = 'auto',
  compact = false,
}: CustomSelectProps) {
  const { accent }    = useTheme()
  const [open, setOpen]         = useState(false)
  const triggerRef              = useRef<HTMLButtonElement>(null)
  const dropRef                 = useRef<HTMLDivElement>(null)
  const [dropStyle, setDropStyle] = useState<React.CSSProperties>({})

  // Outside click — checks both trigger and dropdown panel
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      const insideTrigger = triggerRef.current?.contains(target)
      const insideDrop    = dropRef.current?.contains(target)
      if (!insideTrigger && !insideDrop) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  // Close on page-level scroll — but NOT on scroll within the dropdown
  useEffect(() => {
    if (!open) return
    const handler = (e: Event) => {
      // If the scroll target is the dropdown itself or a child, ignore it
      if (dropRef.current && dropRef.current.contains(e.target as Node)) return
      setOpen(false)
    }
    window.addEventListener('scroll', handler, true)
    return () => window.removeEventListener('scroll', handler, true)
  }, [open])

  const handleOpen = useCallback(() => {
    if (!open && triggerRef.current) {
      const rect       = triggerRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const dropH      = Math.min(280, options.length * 44)
      const openUpward = spaceBelow < dropH && rect.top > dropH
      setDropStyle({
        position: 'fixed',
        top:    openUpward ? undefined : rect.bottom + 4,
        bottom: openUpward ? window.innerHeight - rect.top + 4 : undefined,
        left:   rect.left,
        minWidth: rect.width,
        zIndex: 9999,
      })
    }
    setOpen(v => !v)
  }, [open, options.length])

  const handleSelect = useCallback((val: string) => {
    onChange(val)
    setOpen(false)
  }, [onChange])

  const selected     = options.find(o => o.value === value)
  const displayLabel = selected?.label || placeholder
  const displayColor = selected?.color
  const padding      = compact ? '5px 10px' : '8px 12px'
  const fontSize     = compact ? 11 : 12

  return (
    <div style={{ position: 'relative', width, userSelect: 'none' }}>
      {/* Trigger */}
      <button
        ref={triggerRef}
        type="button"
        onClick={handleOpen}
        style={{
          width: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          padding,
          background: open ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.05)',
          border: `1px solid ${open ? hexToRgba(accent, 0.4) : 'rgba(255,255,255,0.1)'}`,
          borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s', outline: 'none', minWidth: 0,
        }}
      >
        <span style={{
          fontSize, fontWeight: 600,
          color: displayColor || '#fff',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          flex: 1, textAlign: 'left',
        }}>
          {displayLabel}
        </span>
        <span style={{
          fontSize: 8, color: 'rgba(255,255,255,0.3)', flexShrink: 0,
          transition: 'transform 0.15s', display: 'inline-block',
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
        }}>
          ▾
        </span>
      </button>

      {/* Dropdown — fixed position, ref-tracked for outside-click safety */}
      {open && typeof window !== 'undefined' && createPortal(
        <div
          ref={dropRef}
          style={{
            ...dropStyle,
            background: '#111',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 10,
            boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
            maxHeight: 280,
            overflowY: 'auto',
            overflowX: 'hidden',
            scrollbarWidth: 'thin' as const,
            scrollbarColor: 'rgba(255,255,255,0.15) transparent',
          }}
        >
          {options.map(option => {
            const isActive = option.value === value
            return (
              <div
                key={option.value}
                onMouseDown={e => {
                  // Use onMouseDown + preventDefault so the outside-click
                  // handler (mousedown on document) does not fire first
                  e.preventDefault()
                  handleSelect(option.value)
                }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                  padding: compact ? '8px 12px' : '10px 14px',
                  cursor: 'pointer',
                  background: isActive ? hexToRgba(accent, 0.1) : 'transparent',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => {
                  if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
                }}
                onMouseLeave={e => {
                  if (!isActive) e.currentTarget.style.background = 'transparent'
                }}
              >
                <span style={{
                  fontSize, fontWeight: isActive ? 700 : 400,
                  color: option.color || (isActive ? '#fff' : 'rgba(255,255,255,0.7)'),
                }}>
                  {option.label}
                </span>
                {isActive && (
                  <span style={{ fontSize: 10, color: accent, flexShrink: 0 }}>✓</span>
                )}
              </div>
            )
          })}
        </div>,
        document.body
      )}
    </div>
  )
}
