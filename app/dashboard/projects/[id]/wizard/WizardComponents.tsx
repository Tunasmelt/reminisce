'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { 
  Check, ChevronRight, ChevronDown, Zap, 
  GripVertical, X 
} from 'lucide-react'
import { 
  STAGE_META, STAGE_ORDER,
  type WizardStageKey, type TechStackOption, 
  type ConfirmedFeature, type WizardModel 
} from '@/lib/wizard-stages'
import { AIProvider } from '@/lib/ai-client'

function hexToRgba(hex: string, a: number) {
  if (!hex || hex.length < 7) return `rgba(245,158,11,${a})`
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

const TYPE_COLORS: Record<string, string> = {
  frontend:     '#60a5fa',
  backend:      '#34d399',
  database:     '#f59e0b',
  testing:      '#a78bfa',
  architecture: '#f87171',
}

const PRIORITY_COLORS: Record<string, string> = {
  core:           '#10b981',
  'nice-to-have': '#f59e0b',
  future:         '#6b7280',
}

export function StageProgress({
  currentStage, completedStages, accent,
}: {
  currentStage: WizardStageKey
  completedStages: WizardStageKey[]
  accent: string
}) {
  const display = STAGE_ORDER.filter(s => s !== 'generating' && s !== 'complete')
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 0,
      padding: '0 20px', height: 48,
      borderBottom: '1px solid rgba(255,255,255,0.07)',
      background: 'rgba(8,8,20,0.6)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      flexShrink: 0, overflowX: 'auto',
    }}>
      {display.map((stage, i) => {
        const isDone   = completedStages.includes(stage)
        const isActive = currentStage === stage
        return (
          <div key={stage} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '4px 10px', borderRadius: 8,
              background: isActive ? hexToRgba(accent, 0.1) : 'transparent',
              border: isActive
                ? `1px solid ${hexToRgba(accent, 0.25)}`
                : '1px solid transparent',
              transition: 'all 0.2s',
            }}>
              <div style={{
                width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isDone ? '#10b981' : isActive ? accent : 'rgba(255,255,255,0.1)',
              }}>
                {isDone
                  ? <Check size={9} color="#000" strokeWidth={3} />
                  : isActive
                    ? <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#000' }} />
                    : null}
              </div>
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', whiteSpace: 'nowrap',
                color: isDone ? '#10b981' : isActive ? accent : 'rgba(255,255,255,0.25)',
              }}>
                {STAGE_META[stage].shortLabel}
              </span>
            </div>
            {i < display.length - 1 && (
              <ChevronRight size={12} color="rgba(255,255,255,0.15)" />
            )}
          </div>
        )
      })}
    </div>
  )
}

export function TechStackCard({
  option, selected, onSelect, accent,
}: {
  option: TechStackOption
  selected: boolean
  onSelect: () => void
  accent: string
}) {
  const complexityColor = {
    simple:   '#10b981',
    standard: '#f59e0b',
    scalable: '#8b5cf6',
  }[option.complexity]

  return (
    <button onClick={onSelect} style={{
      width: '100%', textAlign: 'left', padding: '16px 18px',
      background: selected ? hexToRgba(accent, 0.08) : 'rgba(255,255,255,0.025)',
      border: selected ? `2px solid ${accent}` : '1px solid rgba(255,255,255,0.07)',
      borderRadius: 16, cursor: 'pointer', transition: 'all 0.15s',
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: 12, right: 14,
        fontSize: 9, fontWeight: 900, letterSpacing: '0.1em',
        color: selected ? accent : 'rgba(255,255,255,0.2)',
        background: selected ? hexToRgba(accent, 0.15) : 'rgba(255,255,255,0.05)',
        padding: '2px 8px', borderRadius: 999,
        border: `1px solid ${selected ? hexToRgba(accent, 0.3) : 'rgba(255,255,255,0.08)'}`,
      }}>
        OPTION {option.id}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{option.label}</span>
        <span style={{
          fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 999,
          background: `${complexityColor}20`, color: complexityColor,
          border: `1px solid ${complexityColor}40`,
        }}>
          {option.tag}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', marginBottom: 12 }}>
        {([['Frontend', option.frontend], ['Backend', option.backend],
           ['Database', option.database], ['Hosting', option.hosting]] as [string,string][])
          .map(([label, value]) => (
          <div key={label}>
            <div style={{
              fontSize: 9, color: 'rgba(255,255,255,0.35)',
              textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>{label}</div>
            <div style={{ fontSize: 11, color: '#fff', fontWeight: 500 }}>{value}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
        {option.pros.slice(0, 3).map((p, i) => (
          <span key={i} style={{
            fontSize: 10, padding: '2px 8px', borderRadius: 999,
            background: 'rgba(16,185,129,0.1)', color: '#10b981',
            border: '1px solid rgba(16,185,129,0.2)',
          }}>✓ {p}</span>
        ))}
      </div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontStyle: 'italic' }}>
        Best for: {option.bestFor}
      </div>
    </button>
  )
}

export function FeatureCard({
  feature, accent, onToggle, onEdit, onRemove,
}: {
  feature: ConfirmedFeature
  accent: string
  onToggle: () => void
  onEdit: (field: keyof ConfirmedFeature, value: string) => void
  onRemove: () => void
}) {
  const [editingName, setEditingName] = useState(false)
  const [editingDesc, setEditingDesc] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)
  const descRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { if (editingName) nameRef.current?.focus() }, [editingName])
  useEffect(() => { if (editingDesc) descRef.current?.focus() }, [editingDesc])

  const isOff     = !feature.confirmed

  return (
    <div style={{
      display: 'flex', gap: 8, alignItems: 'flex-start',
      padding: '10px 12px',
      background: isOff ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.04)',
      border: `1px solid ${isOff ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.09)'}`,
      borderRadius: 10, opacity: isOff ? 0.5 : 1, transition: 'all 0.15s',
    }}>
      <div style={{ cursor: 'grab', color: 'rgba(255,255,255,0.2)', paddingTop: 2, flexShrink: 0 }}>
        <GripVertical size={14} />
      </div>
      <button onClick={onToggle} style={{
        width: 18, height: 18, borderRadius: 5, flexShrink: 0, marginTop: 1,
        background: feature.confirmed ? accent : 'transparent',
        border: `1.5px solid ${feature.confirmed ? accent : 'rgba(255,255,255,0.25)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', transition: 'all 0.15s',
      }}>
        {feature.confirmed && <Check size={10} color="#000" strokeWidth={3} />}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        {editingName ? (
          <input
            ref={nameRef}
            defaultValue={feature.name}
            onBlur={e => { onEdit('name', e.target.value); setEditingName(false) }}
            onKeyDown={e => {
              if (e.key === 'Enter') { onEdit('name', e.currentTarget.value); setEditingName(false) }
            }}
            style={{
              width: '100%', background: 'rgba(255,255,255,0.08)',
              border: `1px solid ${accent}`, borderRadius: 6,
              padding: '2px 8px', fontSize: 12, fontWeight: 600, color: '#fff',
              outline: 'none', fontFamily: 'inherit',
            }}
          />
        ) : (
          <div
            onClick={() => !isOff && setEditingName(true)}
            style={{
              fontSize: 12, fontWeight: 600, color: '#fff', marginBottom: 3,
              cursor: isOff ? 'default' : 'text',
              textDecoration: isOff ? 'line-through' : 'none',
            }}
          >
            {feature.name}
          </div>
        )}
        {editingDesc ? (
          <textarea
            ref={descRef}
            defaultValue={feature.description}
            onBlur={e => { onEdit('description', e.target.value); setEditingDesc(false) }}
            rows={2}
            style={{
              width: '100%', background: 'rgba(255,255,255,0.08)',
              border: `1px solid ${accent}`, borderRadius: 6,
              padding: '4px 8px', fontSize: 11, color: 'rgba(255,255,255,0.7)',
              outline: 'none', resize: 'none', fontFamily: 'inherit',
            }}
          />
        ) : (
          <div
            onClick={() => !isOff && setEditingDesc(true)}
            style={{
              fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 1.4,
              cursor: isOff ? 'default' : 'text',
            }}
          >
            {feature.description}
          </div>
        )}
        <div style={{ display: 'flex', gap: 5, marginTop: 6, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
            background: `${TYPE_COLORS[feature.type] || 'rgba(255,255,255,0.4)'}18`, 
            color: TYPE_COLORS[feature.type] || 'rgba(255,255,255,0.4)',
            border: `1px solid ${TYPE_COLORS[feature.type] || 'rgba(255,255,255,0.4)'}30`,
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>{feature.type}</span>
          <span style={{
            fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
            background: `${PRIORITY_COLORS[feature.priority] || '#6b7280'}18`, 
            color: PRIORITY_COLORS[feature.priority] || '#6b7280',
            border: `1px solid ${PRIORITY_COLORS[feature.priority] || '#6b7280'}30`,
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>{feature.priority}</span>
        </div>
      </div>
      <button
        onClick={onRemove}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.2)', padding: 2, flexShrink: 0, transition: 'color 0.15s' }}
        onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
        onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.2)')}
      >
        <X size={12} />
      </button>
    </div>
  )
}

export function ModelSelector({
  models, selectedModel, onSelect, accent,
}: {
  models: readonly WizardModel[]
  selectedModel: string
  onSelect: (model: string, provider: AIProvider) => void
  accent: string
}) {
  const [open, setOpen]       = useState(false)
  const triggerRef             = useRef<HTMLButtonElement>(null)
  const dropRef                = useRef<HTMLDivElement>(null)
  const [dropPos, setDropPos]  = useState({ top: 0, right: 0 })
  const current             = models.find(m => m.model === selectedModel)
  const isFree              = current?.free ?? true

  const freeModels = models.filter(m => m.free)
  const proModels  = models.filter(m => !m.free)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const t = e.target as Node
      if (!triggerRef.current?.contains(t) && !dropRef.current?.contains(t))
        setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: Event) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    window.addEventListener('scroll', handler, true)
    return () => window.removeEventListener('scroll', handler, true)
  }, [open])

  const handleOpen = useCallback(() => {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setDropPos({
        top: rect.bottom + 6,
        right: window.innerWidth - rect.right,
      })
    }
    setOpen(v => !v)
  }, [open])

  const itemStyle = (isSelected: boolean, selBg: string): React.CSSProperties => ({
    width: '100%', textAlign: 'left', padding: '9px 12px',
    background: isSelected ? selBg : 'transparent',
    border: 'none', borderBottom: '1px solid rgba(255,255,255,0.04)',
    cursor: 'pointer', display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', gap: 8, transition: 'background 0.1s',
  })

  return (
    <>
      <button ref={triggerRef} onClick={handleOpen} style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '5px 10px',
        background: 'rgba(255,255,255,0.05)',
        border: open ? `1px solid ${hexToRgba(accent, 0.4)}` : '1px solid rgba(255,255,255,0.1)',
        borderRadius: 8, cursor: 'pointer',
        fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.7)',
        maxWidth: 180, transition: 'all 0.15s',
      }}>
        <Zap size={10} color={isFree ? '#10b981' : accent} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {current?.label ?? 'Select model'}
        </span>
        {(current as WizardModel & { badge?: string })?.badge && (
          <span style={{
            fontSize: 8, fontWeight: 800, padding: '1px 5px', borderRadius: 4,
            background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)', flexShrink: 0,
          }}>
            {(current as WizardModel & { badge?: string }).badge}
          </span>
        )}
        <ChevronDown size={10} style={{
          flexShrink: 0, transform: open ? 'rotate(180deg)' : 'rotate(0)',
          transition: 'transform 0.15s',
        }} />
      </button>

      {open && typeof window !== 'undefined' && createPortal(
        <div ref={dropRef} style={{
          position: 'fixed',
          top: dropPos.top,
          right: dropPos.right,
          width: 260,
          background: 'rgba(8,8,24,0.98)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 14,
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
          zIndex: 9999,
          maxHeight: 400,
          overflowY: 'auto',
        }}>
          <div style={{
            padding: '10px 12px 4px', fontSize: 8, fontWeight: 800,
            letterSpacing: '0.15em', color: '#10b981', textTransform: 'uppercase',
          }}>★ Free Tier</div>
          {freeModels.map(m => (
            <button
              key={m.model}
              onClick={() => { onSelect(m.model, m.provider as AIProvider); setOpen(false) }}
              style={itemStyle(selectedModel === m.model, 'rgba(16,185,129,0.08)')}
              onMouseEnter={e => {
                if (selectedModel !== m.model)
                  (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background =
                  selectedModel === m.model ? 'rgba(16,185,129,0.08)' : 'transparent'
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 500, color: '#fff' }}>{m.label}</span>
              {(m as WizardModel & { badge?: string }).badge && (
                <span style={{
                  fontSize: 8, fontWeight: 800, padding: '2px 6px', borderRadius: 4,
                  background: 'rgba(16,185,129,0.15)', color: '#10b981',
                  border: '1px solid rgba(16,185,129,0.2)',
                }}>
                  {(m as WizardModel & { badge?: string }).badge}
                </span>
              )}
            </button>
          ))}
          <div style={{
            padding: '10px 12px 4px', fontSize: 8, fontWeight: 800,
            letterSpacing: '0.15em', color: accent, textTransform: 'uppercase',
            borderTop: '1px solid rgba(255,255,255,0.07)',
          }}>💎 Pro Tier</div>
          {proModels.map(m => (
            <button
              key={m.model}
              onClick={() => { onSelect(m.model, m.provider as AIProvider); setOpen(false) }}
              style={itemStyle(selectedModel === m.model, hexToRgba(accent, 0.1))}
              onMouseEnter={e => {
                if (selectedModel !== m.model)
                  (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background =
                  selectedModel === m.model ? hexToRgba(accent, 0.1) : 'transparent'
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 500, color: '#fff' }}>{m.label}</span>
              {(m as WizardModel & { badge?: string }).badge && (
                <span style={{
                  fontSize: 8, fontWeight: 800, padding: '2px 6px', borderRadius: 4,
                  background: hexToRgba(accent, 0.15), color: accent,
                  border: `1px solid ${hexToRgba(accent, 0.25)}`,
                }}>
                  {(m as WizardModel & { badge?: string }).badge}
                </span>
              )}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  )
}
