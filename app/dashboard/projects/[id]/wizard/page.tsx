'use client'

import {
  useState, useEffect, useRef, useCallback, useMemo,
} from 'react'
import { createPortal } from 'react-dom'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import { useTheme } from '@/hooks/useTheme'
import { useFileSystem } from '@/hooks/useFileSystem'
import { toast } from 'sonner'
import {
  ArrowUp, Sparkles, RefreshCw, AlertTriangle,
  CheckCircle2, ChevronRight, FolderOpen,
  RotateCcw, Zap, X, Check, ChevronDown,
  GripVertical, Plus, FileText,
} from 'lucide-react'
import {
  STAGE_META,
  STAGE_ORDER,
  GENERATION_STEPS,
  ALL_WIZARD_MODELS,
  WIZARD_FREE_MODELS,
  WIZARD_PRO_MODELS,
  getStageIndex,
  stripSignals,
  type WizardStageKey,
  type ConfirmedFeature,
  type TechStackOption,
  type WizardError,
  type WizardModel,
  classifyError,
} from '@/lib/wizard-stages'
import { getTimeUntilUTCReset } from '@/lib/wallet'
import type { AIProvider } from '@/lib/ai-client'

// ─────────────────────────────────────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────────────────────────────────────

type Message = { role: 'user' | 'assistant' | 'system'; content: string }

interface Blueprint {
  architecture?: string
  techStack?: Record<string, string>
  phases?: Array<{
    name: string
    description: string
    features?: Array<{ name: string; description: string; type?: string }>
  }>
  markdownFiles?: Record<string, string>
  masterPromptTitle?: string
}

interface GenerationEvent {
  type: 'wave_start' | 'step_start' | 'step_complete' | 'step_error'
      | 'step_skip' | 'saving' | 'complete' | 'error'
  wave?: number
  step?: number
  label?: string
  description?: string
  error?: string
  action?: string
  fatal?: boolean
  resumeStep?: number
  blueprint?: Blueprint
}

// ─────────────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────────────

function hexToRgba(hex: string, a: number) {
  if (!hex || hex.length < 7) return `rgba(245,158,11,${a})`
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

function glassCard(extra?: React.CSSProperties): React.CSSProperties {
  return {
    background: 'rgba(255,255,255,0.04)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.09)',
    borderRadius: 14,
    ...extra,
  }
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

// ─────────────────────────────────────────────────────────────────────────────
//  StageProgress
// ─────────────────────────────────────────────────────────────────────────────

function StageProgress({
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
      padding: '0 20px', height: 44,
      borderBottom: '1px solid rgba(255,255,255,0.07)',
      background: 'rgba(255,255,255,0.02)',
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

// ─────────────────────────────────────────────────────────────────────────────
//  TechStackCard
// ─────────────────────────────────────────────────────────────────────────────

function TechStackCard({
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
      background: selected ? hexToRgba(accent, 0.08) : 'rgba(255,255,255,0.03)',
      border: `2px solid ${selected ? accent : 'rgba(255,255,255,0.08)'}`,
      borderRadius: 14, cursor: 'pointer', transition: 'all 0.15s',
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

// ─────────────────────────────────────────────────────────────────────────────
//  FeatureCard — interactive, draggable, editable, tickable
// ─────────────────────────────────────────────────────────────────────────────

function FeatureCard({
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

  const typeColor = TYPE_COLORS[feature.type] || 'rgba(255,255,255,0.4)'
  const priColor  = PRIORITY_COLORS[feature.priority] || '#6b7280'
  const isOff     = !feature.confirmed

  return (
    <div style={{
      display: 'flex', gap: 8, alignItems: 'flex-start',
      padding: '10px 12px',
      background: isOff ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.04)',
      border: `1px solid ${isOff ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.09)'}`,
      borderRadius: 10, opacity: isOff ? 0.5 : 1, transition: 'all 0.15s',
    }}>
      {/* Drag grip */}
      <div style={{ cursor: 'grab', color: 'rgba(255,255,255,0.2)', paddingTop: 2, flexShrink: 0 }}>
        <GripVertical size={14} />
      </div>

      {/* Tick */}
      <button onClick={onToggle} style={{
        width: 18, height: 18, borderRadius: 5, flexShrink: 0, marginTop: 1,
        background: feature.confirmed ? accent : 'transparent',
        border: `1.5px solid ${feature.confirmed ? accent : 'rgba(255,255,255,0.25)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', transition: 'all 0.15s',
      }}>
        {feature.confirmed && <Check size={10} color="#000" strokeWidth={3} />}
      </button>

      {/* Content */}
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
            background: `${typeColor}18`, color: typeColor,
            border: `1px solid ${typeColor}30`,
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>{feature.type}</span>
          <span style={{
            fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
            background: `${priColor}18`, color: priColor,
            border: `1px solid ${priColor}30`,
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>{feature.priority}</span>
        </div>
      </div>

      {/* Remove */}
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

// ─────────────────────────────────────────────────────────────────────────────
//  GenerationProgress — wave-aware
// ─────────────────────────────────────────────────────────────────────────────

function GenerationProgress({
  steps, currentStep, completedSteps, errorStep, accent,
}: {
  steps: typeof GENERATION_STEPS
  currentStep: number
  completedSteps: number[]
  errorStep: number | null
  accent: string
}) {
  const waves = [
    { wave: 1, label: 'Wave 1 — Parallel', steps: steps.filter(s => s.wave === 1) },
    { wave: 2, label: 'Wave 2 — Parallel', steps: steps.filter(s => s.wave === 2) },
    { wave: 3, label: 'Wave 3 — Synthesis', steps: steps.filter(s => s.wave === 3) },
  ]
  return (
    <div style={{ padding: 24 }}>
      <div style={{
        fontSize: 9, fontWeight: 800, letterSpacing: '0.14em',
        color: accent, textTransform: 'uppercase', marginBottom: 20,
      }}>
        Generating Blueprint
      </div>
      {waves.map(({ wave, label, steps: ws }) => {
        const waveCompleted = ws.every(s => completedSteps.includes(s.index))
        const waveActive    = ws.some(s => s.index === currentStep)
        return (
          <div key={wave} style={{ marginBottom: 20 }}>
            <div style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
              color: waveCompleted ? '#10b981' : waveActive ? accent : 'rgba(255,255,255,0.2)',
              marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6,
            }}>
              {waveCompleted
                ? <Check size={10} color="#10b981" />
                : waveActive
                  ? <div style={{ width: 8, height: 8, borderRadius: '50%', background: accent, animation: 'wPulse 1s infinite' }} />
                  : <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
              }
              {label}
              {ws.length > 1 && waveActive && (
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>running in parallel</span>
              )}
            </div>
            <div style={{ paddingLeft: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {ws.map(step => {
                const done    = completedSteps.includes(step.index)
                const running = step.index === currentStep
                const failed  = errorStep === step.index
                return (
                  <div key={step.index} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 12px', borderRadius: 10,
                    background: running
                      ? hexToRgba(accent, 0.06)
                      : done ? 'rgba(16,185,129,0.04)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${running
                      ? hexToRgba(accent, 0.2)
                      : done ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.05)'}`,
                    transition: 'all 0.2s',
                  }}>
                    <div style={{
                      width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                      background: failed ? '#ef4444' : done ? '#10b981' : running ? accent : 'rgba(255,255,255,0.15)',
                      animation: running ? 'wPulse 1s infinite' : 'none',
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 12, fontWeight: 600,
                        color: done ? '#10b981' : running ? '#fff' : 'rgba(255,255,255,0.4)',
                      }}>
                        {step.label}
                      </div>
                      {running && (
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>
                          {step.description}
                        </div>
                      )}
                    </div>
                    {done && <CheckCircle2 size={13} color="#10b981" />}
                    {failed && <AlertTriangle size={13} color="#ef4444" />}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  ModelSelector — portal-rendered, fixes stale closure
// ─────────────────────────────────────────────────────────────────────────────

function ModelSelector({
  selectedModel, onSelect, accent,
}: {
  selectedModel: string
  onSelect: (model: string, provider: AIProvider) => void
  accent: string
}) {
  const [open, setOpen]       = useState(false)
  const triggerRef             = useRef<HTMLButtonElement>(null)
  const dropRef                = useRef<HTMLDivElement>(null)
  const [dropPos, setDropPos]  = useState({ top: 0, right: 0 })
  const current             = ALL_WIZARD_MODELS.find(m => m.model === selectedModel)
  const isFree              = WIZARD_FREE_MODELS.some(m => m.model === selectedModel)

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

  // Close on scroll outside the dropdown
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
        {(current as (WizardModel & { badge?: string }) | undefined)?.badge && (
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
          {WIZARD_FREE_MODELS.map(m => (
            <button
              key={m.model}
              onClick={() => { onSelect(m.model, m.provider); setOpen(false) }}
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
          {WIZARD_PRO_MODELS.map(m => (
            <button
              key={m.model}
              onClick={() => { onSelect(m.model, m.provider); setOpen(false) }}
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

// ─────────────────────────────────────────────────────────────────────────────
//  ErrorBanner
// ─────────────────────────────────────────────────────────────────────────────

function ErrorBanner({
  error, onDismiss, onRetry, accent,
}: {
  error: WizardError
  onDismiss: () => void
  onRetry: () => void
  accent: string
}) {
  const [secondsLeft, setSecondsLeft] = useState(error.retryAfterSeconds ?? 0)
  useEffect(() => {
    if (!error.retryAfterSeconds) return
    setSecondsLeft(error.retryAfterSeconds)
    const t = setInterval(() => setSecondsLeft(p => { if (p <= 1) { clearInterval(t); return 0 } return p - 1 }), 1000)
    return () => clearInterval(t)
  }, [error.retryAfterSeconds])

  return (
    <div style={{
      margin: '0 16px 8px', padding: '12px 14px',
      background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.25)',
      borderRadius: 10, display: 'flex', alignItems: 'flex-start', gap: 10, flexShrink: 0,
    }}>
      <AlertTriangle size={14} color="#f87171" style={{ flexShrink: 0, marginTop: 1 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: '#f87171', fontWeight: 600, marginBottom: 4 }}>
          {error.message}{secondsLeft > 0 ? ` Retry in ${secondsLeft}s.` : ''}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onRetry} style={{
            fontSize: 10, fontWeight: 700, padding: '3px 10px',
            background: hexToRgba(accent, 0.1), border: `1px solid ${hexToRgba(accent, 0.25)}`,
            borderRadius: 6, cursor: 'pointer', color: accent,
          }}>{error.actionLabel}</button>
          <button onClick={onDismiss} style={{
            fontSize: 10, fontWeight: 600, padding: '3px 8px', background: 'transparent',
            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6,
            cursor: 'pointer', color: 'rgba(255,255,255,0.4)',
          }}>Dismiss</button>
        </div>
      </div>
      <button onClick={onDismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>
        <X size={13} />
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  InjectModal
// ─────────────────────────────────────────────────────────────────────────────

function InjectModal({
  files, folderName, isConnected, onConnect, onConfirm, onClose, accent,
}: {
  files: Record<string, string>
  folderName: string | null
  isConnected: boolean
  onConnect: () => void
  onConfirm: () => Promise<void>
  onClose: () => void
  accent: string
}) {
  const [writing, setWriting] = useState(false)
  const [done,    setDone]    = useState(false)
  const [written, setWritten] = useState<string[]>([])
  const entries = Object.entries(files)

  const handleWrite = async () => {
    setWriting(true)
    await onConfirm()
    setWritten(entries.map(([p]) => p))
    setDone(true)
    setWriting(false)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
      backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
      zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        background: 'rgba(12,12,28,0.98)', border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 20, padding: '28px 32px', maxWidth: 520, width: '100%',
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)', maxHeight: '80vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>
            {done ? '✅ Files written' : 'Inject blueprint to local folder'}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)' }}>
            <X size={16} />
          </button>
        </div>

        {!isConnected && !done ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 16, lineHeight: 1.6 }}>
              Connect a local folder to write the blueprint files directly to your project directory.
            </div>
            <button onClick={onConnect} style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '10px 20px', background: hexToRgba(accent, 0.1),
              border: `1px solid ${hexToRgba(accent, 0.3)}`,
              borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 700, color: accent,
            }}>
              <FolderOpen size={14} /> Connect folder
            </button>
          </div>
        ) : (
          <>
            {folderName && (
              <div style={{
                fontSize: 11, color: accent, fontFamily: 'monospace',
                background: hexToRgba(accent, 0.08), border: `1px solid ${hexToRgba(accent, 0.2)}`,
                borderRadius: 8, padding: '6px 12px', marginBottom: 16,
              }}>
                📁 /{folderName}
              </div>
            )}
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 10 }}>
              {entries.length} files to write:
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 260, overflowY: 'auto', marginBottom: 20 }}>
              {entries.map(([path, content]) => {
                const isWritten = written.includes(path)
                const sizeKb    = (new TextEncoder().encode(content).length / 1024).toFixed(1)
                return (
                  <div key={path} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8,
                    background: isWritten ? 'rgba(16,185,129,0.05)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${isWritten ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.05)'}`,
                  }}>
                    {isWritten
                      ? <Check size={11} color="#10b981" />
                      : <FileText size={11} color="rgba(255,255,255,0.3)" />
                    }
                    <span style={{
                      flex: 1, fontSize: 11, fontFamily: 'monospace',
                      color: isWritten ? '#10b981' : 'rgba(255,255,255,0.6)',
                    }}>{path}</span>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>{sizeKb}kb</span>
                  </div>
                )
              })}
            </div>
            {done ? (
              <div style={{ textAlign: 'center', fontSize: 13, color: '#10b981', fontWeight: 600 }}>
                All {written.length} files written successfully.
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={onClose} style={{
                  padding: '9px 18px', background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10,
                  cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)',
                }}>Cancel</button>
                <button onClick={handleWrite} disabled={writing} style={{
                  padding: '9px 20px', background: accent, border: 'none', borderRadius: 10,
                  cursor: writing ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 800, color: '#000',
                  opacity: writing ? 0.6 : 1, transition: 'opacity 0.15s',
                  boxShadow: `0 0 20px ${hexToRgba(accent, 0.4)}`,
                }}>
                  {writing ? 'Writing...' : 'Write files →'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  WizardPage — main export
// ─────────────────────────────────────────────────────────────────────────────

export default function WizardPage() {
  const params      = useParams()
  const { accent }  = useTheme()
  const ac          = accent || '#f59e0b'
  const projectId   = params.id as string
  const { session } = useAuthStore()

  // ── State ──────────────────────────────────────────────────────────────────
  const [project,            setProject]            = useState<{ name: string } | null>(null)
  const [loading,            setLoading]            = useState(true)
  const [messages,           setMessages]           = useState<Message[]>([])
  const [inputMsg,           setInputMsg]           = useState('')
  const [isTyping,           setIsTyping]           = useState(false)
  const [isGenerating,       setIsGenerating]       = useState(false)
  const [rightTab,           setRightTab]           = useState<'preview' | 'files'>('preview')
  const [currentStage,       setCurrentStage]       = useState<WizardStageKey>('idea')
  const [completedStages,    setCompletedStages]    = useState<WizardStageKey[]>([])
  const [generatedBlueprint, setGeneratedBlueprint] = useState<Blueprint | null>(null)
  const [pendingFeatures,    setPendingFeatures]    = useState<ConfirmedFeature[]>([])
  const [stackOptions,       setStackOptions]       = useState<TechStackOption[]>([])
  const [selectedStack,      setSelectedStack]      = useState<TechStackOption | null>(null)
  const [pendingStack,       setPendingStack]       = useState<TechStackOption | null>(null)
  const [genCurrentStep,     setGenCurrentStep]     = useState(-1)
  const [genCompletedSteps,  setGenCompletedSteps]  = useState<number[]>([])
  const [genErrorStep,       setGenErrorStep]       = useState<number | null>(null)
  const [resumeStep,         setResumeStep]         = useState(0)
  const [activeError,        setActiveError]        = useState<WizardError | null>(null)
  const [lastUserMessage,    setLastUserMessage]    = useState('')
  const [showInjectModal,    setShowInjectModal]    = useState(false)
  const [showRegenConfirm,   setShowRegenConfirm]   = useState(false)
  const [selectedModel, setSelectedModel] = useState<string>(() =>
    typeof window !== 'undefined' ? (localStorage.getItem('wizard_model') || 'llama-3.1-8b-instant') : 'llama-3.1-8b-instant'
  )
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>(() =>
    typeof window !== 'undefined' ? ((localStorage.getItem('wizard_provider') as AIProvider) || 'groq') : 'groq'
  )
  const [leftWidth, setLeftWidth] = useState(50)

  // ── Refs ───────────────────────────────────────────────────────────────────
  const containerRef    = useRef<HTMLDivElement>(null)
  const isDragging      = useRef(false)
  const isGeneratingRef = useRef(false)
  const initialized     = useRef(false)
  const sessionIdRef    = useRef<string | null>(null)
  const currentStageRef = useRef<WizardStageKey>('idea')
  const chatBottomRef   = useRef<HTMLDivElement>(null)
  const rightPanelRef   = useRef<HTMLDivElement>(null)
  const dragFrom        = useRef<number | null>(null)
  const MIN_LEFT = 30; const MAX_LEFT = 70

  const { isConnected, folderName, isSupported, openFolder, writeFile, initProject, pushToLocal } =
    useFileSystem(projectId)

  // ── Drag resize ────────────────────────────────────────────────────────────
  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDragging.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    const onMove = (ev: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      setLeftWidth(Math.min(MAX_LEFT, Math.max(MIN_LEFT, ((ev.clientX - rect.left) / rect.width) * 100)))
    }
    const onUp = () => {
      isDragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [])

  // ── Auto-scroll ────────────────────────────────────────────────────────────
  useEffect(() => { chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, isTyping])
  useEffect(() => { if (rightPanelRef.current) rightPanelRef.current.scrollTop = 0 }, [rightTab, currentStage])

  // ── Session load ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    const init = async () => {
      const [{ data: proj }, { data: sessions }] = await Promise.all([
        supabase.from('projects').select('name').eq('id', projectId).single(),
        supabase.from('wizard_sessions').select('*').eq('project_id', projectId)
          .order('created_at', { ascending: false }).limit(1),
      ])
      if (proj) setProject(proj)
      if (sessions && sessions.length > 0) {
        const sess = sessions[0]
        sessionIdRef.current    = sess.id
        const stage             = (sess.stage ?? 'idea') as WizardStageKey
        setCurrentStage(stage)
        currentStageRef.current = stage
        setCompletedStages(sess.completed_stages ?? [])
        setPendingFeatures(sess.confirmed_features ?? [])
        setStackOptions(sess.stack_options ?? [])
        if (sess.selected_stack?.id) { setSelectedStack(sess.selected_stack); setPendingStack(sess.selected_stack) }
        const chatMsgs = (sess.messages ?? [])
          .filter((m: Message) => m.role !== 'system')
          .map((m: Message) => ({ ...m, content: stripSignals(m.content) }))
        const seen = new Set<string>()
        setMessages(chatMsgs.filter((m: Message) => {
          const k = `${m.role}::${m.content}`; if (seen.has(k)) return false; seen.add(k); return true
        }))
        if (sess.stage === 'complete' || sess.generation_status === 'complete') {
          // Restore blueprint base from session row
          const restoredBlueprint: Blueprint = {
            architecture: sess.architecture?.description ?? '',
            techStack:    sess.workflow ?? {},
          }

          // Load markdownFiles from contexts table so the Files tab
          // and Inject modal work on returning sessions.
          // contexts were bulk-inserted by saveBlueprint in generate route.
          try {
            const { data: ctxRows } = await supabase
              .from('contexts')
              .select('file_path, content')
              .eq('project_id', projectId)

            if (ctxRows && ctxRows.length > 0) {
              const markdownFiles: Record<string, string> = {}
              for (const row of ctxRows) {
                if (row.file_path && typeof row.content === 'string') {
                  markdownFiles[row.file_path] = row.content
                }
              }
              restoredBlueprint.markdownFiles = markdownFiles
            }
          } catch { /* non-fatal — files tab will be empty but core blueprint still shows */ }

          setGeneratedBlueprint(restoredBlueprint)
          setIsGenerating(false)
        }
        if (sess.generation_status === 'generating') { setGenCurrentStep(sess.generation_step ?? 0); setResumeStep(sess.generation_step ?? 0) }
        if (sess.last_error) setActiveError(classifyError(new Error(sess.last_error)))
      }
      setSelectedModel(prev => {
        const known = ALL_WIZARD_MODELS.some(m => m.model === prev)
        if (!known) { localStorage.setItem('wizard_model', 'llama-3.1-8b-instant'); localStorage.setItem('wizard_provider', 'groq'); setSelectedProvider('groq'); return 'llama-3.1-8b-instant' }
        return prev
      })
      setLoading(false)
    }
    init()
  }, [projectId])

  // ── Send message ───────────────────────────────────────────────────────────
  const handleSendMessage = useCallback(async (overrideMsg?: string) => {
    const text = overrideMsg ?? inputMsg
    if (!text.trim() || isTyping || isGenerating) return
    const currentInput = text.trim()
    setInputMsg('')
    setLastUserMessage(currentInput)
    setActiveError(null)
    setMessages(prev => [...prev, { role: 'user', content: currentInput }])
    setIsTyping(true)
    try {
      const res = await fetch('/api/wizard/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ sessionId: sessionIdRef.current, projectId, message: currentInput, provider: selectedProvider, model: selectedModel }),
      })
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        if (res.status === 402) {
          setActiveError({ type: 'rate_limit', message: `Out of coins. Resets ${getTimeUntilUTCReset()}.`, actionLabel: 'Change Model', action: 'change_model' })
          setMessages(prev => prev.slice(0, -1)); setInputMsg(currentInput); return
        }
        const wizError = classifyError(new Error(errBody?.message ?? 'Request failed'))
        setActiveError({ ...wizError, message: errBody?.message ?? wizError.message })
        setMessages(prev => prev.slice(0, -1)); setInputMsg(currentInput); return
      }
      const newId = res.headers.get('X-Session-Id')
      if (newId && !sessionIdRef.current) sessionIdRef.current = newId
      setMessages(prev => [...prev, { role: 'assistant', content: '' }])
      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let assistantText = ''; let buffer = ''
      if (reader) {
        while (true) {
          const { done, value } = await reader.read(); if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n'); buffer = lines.pop() ?? ''
          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed.startsWith('data: ') || trimmed === 'data: [DONE]') continue
            try {
              const parsed = JSON.parse(trimmed.slice(6))
              if (parsed.__wizard_meta) {
                if (typeof parsed.cleanedText === 'string' && parsed.cleanedText.length > 0) {
                  assistantText = parsed.cleanedText
                  setMessages(prev => {
                    const arr = [...prev]
                    if (arr.length > 0 && arr[arr.length - 1].role === 'assistant')
                      arr[arr.length - 1] = { role: 'assistant', content: parsed.cleanedText }
                    return arr
                  })
                }
                if (parsed.stageAdvanced && parsed.nextStage) {
                  setCurrentStage(parsed.nextStage); currentStageRef.current = parsed.nextStage
                  setCompletedStages(prev => prev.includes(parsed.stage ?? '') ? prev : [...prev, parsed.stage ?? ''])
                }
                if (parsed.uiFeatures && Array.isArray(parsed.uiFeatures)) setPendingFeatures(parsed.uiFeatures)
                if (parsed.uiStacks && Array.isArray(parsed.uiStacks)) setStackOptions(parsed.uiStacks)
                if (parsed.stageData?.stack_options) setStackOptions(parsed.stageData.stack_options)
                continue
              }
              const delta = parsed?.choices?.[0]?.delta?.content
              if (delta) {
                assistantText += delta
                setMessages(prev => { const arr = [...prev]; arr[arr.length - 1] = { role: 'assistant', content: stripSignals(assistantText) }; return arr })
              }
              if (parsed?.choices?.[0]?.finish_reason === 'stream_error') { setActiveError(classifyError(new Error('stream died'))); setInputMsg(currentInput) }
            } catch { /* partial */ }
          }
        }
      }
      if (!assistantText.trim()) { setActiveError(classifyError(new Error('stream died'))); setInputMsg(currentInput) }
    } catch (err: unknown) {
      const wizError = classifyError(err); setActiveError(wizError)
      setMessages(prev => { const arr = [...prev]; if (arr[arr.length - 1]?.role === 'assistant') arr.pop(); if (arr[arr.length - 1]?.role === 'user') arr.pop(); return arr })
      setInputMsg(currentInput)
    } finally { setIsTyping(false) }
  }, [inputMsg, isTyping, isGenerating, projectId, session, selectedProvider, selectedModel])

  // ── Confirm features ───────────────────────────────────────────────────────
  const handleConfirmFeatures = useCallback(async () => {
    const toConfirm = pendingFeatures.filter(f => f.confirmed)
    if (toConfirm.length === 0) { toast.error('Select at least one feature.'); return }
    try {
      await fetch('/api/wizard/session', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ sessionId: sessionIdRef.current, confirmed_features: toConfirm, stage: 'stack' }),
      })
      setCurrentStage('stack'); currentStageRef.current = 'stack'
      setCompletedStages(prev => prev.includes('features') ? prev : [...prev, 'features'])
      toast.success(`${toConfirm.length} features confirmed`)
    } catch { toast.error('Failed to save features.') }
  }, [pendingFeatures, session])

  // ── Generate blueprint ─────────────────────────────────────────────────────
  const handleGenerate = useCallback(async (fromResumeStep = 0) => {
    // EC-16: warn on regeneration — use modal not window.confirm
    if (generatedBlueprint && fromResumeStep === 0) {
      setShowRegenConfirm(true)
      return
    }

    if (isGeneratingRef.current) return
    const sid = sessionIdRef.current; if (!sid) return
    isGeneratingRef.current = true; setIsGenerating(true)
    setCurrentStage('generating'); setGenCurrentStep(fromResumeStep)
    setGenCompletedSteps(Array.from({ length: fromResumeStep }, (_, i) => i))
    setGenErrorStep(null); setActiveError(null)
    try {
      const res = await fetch('/api/wizard/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ sessionId: sid, projectId, provider: selectedProvider, model: selectedModel, resumeStep: fromResumeStep }),
      })
      if (!res.ok) {
        if (res.status === 402) {
          setActiveError({ type: 'rate_limit', message: `Out of coins. Resets ${getTimeUntilUTCReset()}.`, actionLabel: 'Change Model', action: 'change_model' })
          setCurrentStage('stack'); return
        }
        const errBody = await res.json().catch(() => ({})); throw new Error(errBody?.error ?? 'Generation failed')
      }
      const reader = res.body?.getReader(); const decoder = new TextDecoder(); let buffer = ''
      if (reader) {
        while (true) {
          const { done, value } = await reader.read(); if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n'); buffer = lines.pop() ?? ''
          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed.startsWith('data: ') || trimmed === 'data: [DONE]') continue
            try {
              const event: GenerationEvent = JSON.parse(trimmed.slice(6))
              switch (event.type) {
                case 'step_start':    setGenCurrentStep(event.step ?? 0); break
                case 'step_complete': setGenCompletedSteps(prev => [...prev, event.step ?? 0]); break
                case 'step_error':    setGenErrorStep(event.step ?? null); if (event.resumeStep !== undefined) setResumeStep(event.resumeStep); break
                case 'complete':
                  setGeneratedBlueprint(event.blueprint ?? null)
                  setCurrentStage('complete'); currentStageRef.current = 'complete'
                  setCompletedStages(prev => prev.includes('stack') ? prev : [...prev, 'stack'])
                  toast.success('Blueprint generated! 🎉'); setRightTab('preview'); break
                case 'error':
                  if (event.error) {
                    setActiveError({ ...classifyError(new Error(event.error)), action: (event.action as WizardError['action']) ?? 'retry' })
                    if (event.resumeStep !== undefined) setResumeStep(event.resumeStep)
                  }; break
              }
            } catch { /* partial */ }
          }
        }
      }
    } catch (err: unknown) { setActiveError(classifyError(err)); setCurrentStage('stack') }
    finally { isGeneratingRef.current = false; setIsGenerating(false) }
  }, [projectId, session, selectedProvider, selectedModel, generatedBlueprint, setShowRegenConfirm])

  // ── Select stack ───────────────────────────────────────────────────────────
  const handleSelectStack = useCallback(async (stack: TechStackOption) => {
    setPendingStack(stack)
    setSelectedStack(stack)

    // Persist stack selection and advance session stage
    if (sessionIdRef.current) {
      try {
        await supabase
          .from('wizard_sessions')
          .update({
            stage: 'generating',
            generation_status: 'idle',
            selected_stack: stack,
            completed_stages: ['idea', 'features', 'stack'],
          })
          .eq('id', sessionIdRef.current)
      } catch { /* non-fatal */ }
    }

    // Advance UI stage then immediately trigger generation
    setCurrentStage('generating')
    setCompletedStages(prev =>
      prev.includes('stack') ? prev : [...prev, 'stack'],
    )
    handleGenerate(0)
  }, [handleGenerate, sessionIdRef])

  // ── Export ZIP ─────────────────────────────────────────────────────────────
  const handleExportZip = useCallback(async () => {
    if (!generatedBlueprint?.markdownFiles) return
    try {
      const { data: { session: s } } = await supabase.auth.getSession()
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s?.access_token}` },
        body: JSON.stringify({ projectId, files: generatedBlueprint.markdownFiles }),
      })
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob(); const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `reminisce-${projectId}.zip`; a.click(); URL.revokeObjectURL(url)
      toast.success('ZIP exported')
    } catch { toast.error('Export failed') }
  }, [projectId, generatedBlueprint])

  // ── Local file injection ───────────────────────────────────────────────────
  const handleInjectFiles = useCallback(async () => {
    if (!generatedBlueprint?.markdownFiles) return
    try {
      await initProject()
      let written = 0
      for (const [path, content] of Object.entries(generatedBlueprint.markdownFiles)) {
        try { await writeFile(path, content as string); written++ } catch { /* non-fatal */ }
      }
      if (written > 0) {
        toast.success(`${written} files written to folder`)
        // Persist sync timestamp — overview page reads this to show indicator
        const syncedAt = new Date().toISOString()
        localStorage.setItem(`blueprint_synced_${projectId}`, syncedAt)
      }
    } catch { toast.error('File injection failed') }
  }, [generatedBlueprint, initProject, writeFile, projectId])

  // ── Feature helpers ────────────────────────────────────────────────────────
  const handleFeatureToggle = useCallback((i: number) => {
    setPendingFeatures(prev => prev.map((f, idx) => idx === i ? { ...f, confirmed: !f.confirmed } : f))
  }, [])
  const handleFeatureEdit = useCallback((i: number, field: keyof ConfirmedFeature, value: string) => {
    setPendingFeatures(prev => prev.map((f, idx) => idx === i ? { ...f, [field]: value } : f))
  }, [])
  const handleFeatureRemove = useCallback((i: number) => {
    setPendingFeatures(prev => prev.filter((_, idx) => idx !== i))
  }, [])
  const handleFeatureAdd = useCallback(() => {
    setPendingFeatures(prev => [...prev, { name: 'New Feature', description: 'Describe this feature', type: 'frontend', priority: 'nice-to-have', confirmed: true }])
  }, [])
  const handleDragStart = useCallback((i: number) => { dragFrom.current = i }, [])
  const handleDragOver  = useCallback((e: React.DragEvent) => e.preventDefault(), [])
  const handleDrop      = useCallback((toIndex: number) => {
    if (dragFrom.current === null || dragFrom.current === toIndex) return
    setPendingFeatures(prev => {
      const arr = [...prev]; const [moved] = arr.splice(dragFrom.current!, 1); arr.splice(toIndex, 0, moved); dragFrom.current = null; return arr
    })
  }, [])

  // ── Quick-reply chips ──────────────────────────────────────────────────────
  const quickChips = useMemo(() => {
    if (currentStage === 'idea') return [
      'I want to add more context to my idea',
      'This looks good, let\'s continue',
      'Can you expand on the features?',
    ]
    if (currentStage === 'features') {
      const first = pendingFeatures[0]?.name
      return [
        first ? `Tell me more about "${first}"` : 'Tell me more about the core features',
        'Add a testing feature',
        'Add an authentication feature',
        'This looks good',
      ]
    }
    if (currentStage === 'stack') return [
      'Tell me more about Option A',
      'Tell me more about Option B',
      'Tell me more about Option C',
      'I want to see a cheaper option',
    ]
    return []
  }, [currentStage, pendingFeatures])

  // ── Derived ────────────────────────────────────────────────────────────────
  const stageIndex        = useMemo(() => getStageIndex(currentStage), [currentStage])
  const isComplete        = currentStage === 'complete'
  const isGeneratingStage = currentStage === 'generating' || isGenerating
  const canGenerate       = (currentStage === 'stack' || currentStage === 'generating') && selectedStack !== null && !isGenerating
  const confirmedCount    = pendingFeatures.filter(f => f.confirmed).length
  const rightPanelMode: 'features' | 'stacks' | 'generating' | 'complete' | 'hint' =
    currentStage === 'features'   ? 'features'
    : currentStage === 'stack'    ? 'stacks'
    : currentStage === 'generating' ? 'generating'
    : currentStage === 'complete' ? 'complete'
    : 'hint'

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ height: 'calc(100vh - 68px)', background: '#07070f', display: 'flex', flexDirection: 'column', gap: 12, padding: 24 }}>
      {[80, '100%', '100%'].map((h, i) => (
        <div key={i} style={{
          height: typeof h === 'number' ? h : undefined,
          flex: typeof h === 'string' ? 1 : undefined,
          background: 'rgba(255,255,255,0.04)', borderRadius: 12,
          animation: 'wPulse 1.5s ease infinite', animationDelay: `${i * 0.15}s`,
        }} />
      ))}
      <style>{`@keyframes wPulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </div>
  )

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div ref={containerRef} style={{
      display: 'flex', height: 'calc(100vh - 68px)',
      background: `linear-gradient(160deg, ${hexToRgba(ac, 0.04)} 0%, transparent 50%), #07070f`,
      overflow: 'hidden',
    }}>
      <style>{`
        @keyframes wPulse  { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes wBounce { 0%,80%,100%{transform:scale(0.6);opacity:0.4} 40%{transform:scale(1);opacity:1} }
      `}</style>

      {/* ══ LEFT PANEL — Chat ══════════════════════════════════════════════════ */}
      <div style={{
        width: `${leftWidth}%`, minWidth: 0, maxWidth: `${MAX_LEFT}%`,
        display: 'flex', flexDirection: 'column',
        borderRight: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(255,255,255,0.01)',
      }}>
        {/* Header */}
        <div style={{
          padding: '0 20px', height: 56,
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          background: 'rgba(255,255,255,0.02)',
          backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
        }}>
          <span style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.35)' }}>Wizard</span>
          {project && (
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
              background: hexToRgba(ac, 0.1), border: `1px solid ${hexToRgba(ac, 0.25)}`, color: ac, letterSpacing: '0.06em',
            }}>{project.name}</span>
          )}
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.2)' }}>
            {STAGE_META[currentStage]?.label}
          </span>
          <div style={{ flex: 1 }} />
          <ModelSelector
            selectedModel={selectedModel}
            onSelect={(m, p) => {
              setSelectedModel(m); setSelectedProvider(p)
              localStorage.setItem('wizard_model', m); localStorage.setItem('wizard_provider', p)
              if (messages.length > 0)
                setMessages(prev => [...prev, { role: 'assistant', content: `↺ Switched to ${ALL_WIZARD_MODELS.find(x => x.model === m)?.label ?? m}. I have full context of our conversation.` }])
            }}
            accent={ac}
          />
        </div>

        {/* Progress bar */}
        <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', flexShrink: 0 }}>
          <div style={{
            height: '100%',
            width: `${Math.min((stageIndex / (STAGE_ORDER.length - 1)) * 100, 100)}%`,
            background: ac, transition: 'width 0.5s ease', borderRadius: '0 999px 999px 0',
          }} />
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 8px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {messages.length === 0 && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{
                width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                background: hexToRgba(ac, 0.1), border: `1px solid ${hexToRgba(ac, 0.25)}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
              }}>✦</div>
              <div style={{ ...glassCard({ padding: '14px 16px', maxWidth: '85%' }), borderRadius: '16px 16px 16px 4px' }}>
                <p style={{ fontSize: 14, color: '#fff', margin: 0, lineHeight: 1.6, marginBottom: 6 }}>
                  Drop your idea here — <strong>one message is enough.</strong>
                </p>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: 0, lineHeight: 1.5 }}>
                  Paste from ChatGPT or Gemini, or describe it in your own words.
                  Features and stack suggestions appear automatically in the right panel.
                </p>
              </div>
            </div>
          )}

          {messages.filter(m => m.role !== 'system').map((msg, i) => {
            const isUser = msg.role === 'user'
            return (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexDirection: isUser ? 'row-reverse' : 'row' }}>
                <div style={{
                  width: 26, height: 26, borderRadius: 7, flexShrink: 0,
                  background: isUser ? hexToRgba(ac, 0.15) : 'rgba(255,255,255,0.06)',
                  border: isUser ? `1px solid ${hexToRgba(ac, 0.3)}` : '1px solid rgba(255,255,255,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, color: isUser ? ac : 'rgba(255,255,255,0.5)',
                }}>
                  {isUser ? 'U' : '✦'}
                </div>
                <div style={{
                  background: isUser ? hexToRgba(ac, 0.12) : 'rgba(255,255,255,0.05)',
                  backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
                  border: isUser ? `1px solid ${hexToRgba(ac, 0.22)}` : '1px solid rgba(255,255,255,0.09)',
                  borderRadius: isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  padding: '11px 15px', maxWidth: '82%',
                  fontSize: 13, color: '#fff', lineHeight: 1.65,
                  whiteSpace: 'pre-wrap', maxHeight: 400, overflowY: 'auto',
                }}>
                  {msg.content}
                </div>
              </div>
            )
          })}

          {isTyping && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{
                width: 26, height: 26, borderRadius: 7, flexShrink: 0,
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, color: 'rgba(255,255,255,0.5)',
              }}>✦</div>
              <div style={{ ...glassCard({ padding: '12px 16px', borderRadius: '16px 16px 16px 4px' }), display: 'flex', gap: 5, alignItems: 'center' }}>
                {[0, 0.2, 0.4].map((d, i) => (
                  <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgba(255,255,255,0.4)', animation: 'wBounce 1.2s infinite', animationDelay: `${d}s` }} />
                ))}
              </div>
            </div>
          )}
          <div ref={chatBottomRef} />
        </div>

        {/* Error banner */}
        {activeError && (
          <ErrorBanner error={activeError} accent={ac}
            onDismiss={() => setActiveError(null)}
            onRetry={() => { setActiveError(null); handleSendMessage(lastUserMessage) }}
          />
        )}

        {/* Input area */}
        {!isGeneratingStage && (
          <div style={{
            borderTop: '1px solid rgba(255,255,255,0.08)', padding: '12px 16px', flexShrink: 0,
            background: 'rgba(8,8,20,0.6)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          }}>
            {/* Confirm features CTA */}
            {currentStage === 'features' && pendingFeatures.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <button onClick={handleConfirmFeatures} style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '10px', background: ac, border: 'none', borderRadius: 10, cursor: 'pointer',
                  fontSize: 12, fontWeight: 800, color: '#000',
                  boxShadow: `0 0 20px ${hexToRgba(ac, 0.35)}`,
                }}>
                  <Check size={14} /> Confirm {confirmedCount} Feature{confirmedCount !== 1 ? 's' : ''} →
                </button>
              </div>
            )}

            {/* Generate CTA */}
            {canGenerate && (
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
                <button onClick={() => handleGenerate(0)} style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  background: ac, color: '#000', border: 'none', borderRadius: 999,
                  padding: '10px 28px', fontSize: 11, fontWeight: 800,
                  letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer',
                  boxShadow: `0 0 24px ${hexToRgba(ac, 0.35)}`,
                }}>
                  <Sparkles size={13} /> Generate Blueprint
                </button>
              </div>
            )}

            {/* Resume */}
            {activeError?.action === 'retry_step' && resumeStep > 0 && (
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
                <button onClick={() => handleGenerate(resumeStep)} style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  background: 'rgba(139,92,246,0.15)', color: '#a78bfa',
                  border: '1px solid rgba(139,92,246,0.3)', borderRadius: 999,
                  padding: '8px 20px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                }}>
                  <RotateCcw size={12} /> Resume from Step {resumeStep + 1}
                </button>
              </div>
            )}

            {/* Regenerate */}
            {isComplete && (
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
                <button onClick={() => setShowRegenConfirm(true)} style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)',
                  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 999,
                  padding: '8px 20px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                }}>
                  <RefreshCw size={12} /> Regenerate Blueprint
                </button>
              </div>
            )}

            {/* Quick-reply chips */}
            {quickChips.length > 0 && !isTyping && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {quickChips.map((chip, i) => (
                  <button key={i} onClick={() => handleSendMessage(chip)} style={{
                    padding: '4px 11px', fontSize: 11, fontWeight: 500,
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)',
                    borderRadius: 999, cursor: 'pointer', color: 'rgba(255,255,255,0.55)', transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = hexToRgba(ac, 0.3); e.currentTarget.style.color = ac }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'; e.currentTarget.style.color = 'rgba(255,255,255,0.55)' }}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            )}

            {/* Textarea + send */}
            <div style={{ display: 'flex', gap: 8 }}>
              <textarea
                value={inputMsg}
                onChange={e => setInputMsg(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage() } }}
                placeholder={
                  isTyping            ? 'Waiting for response...'
                  : currentStage === 'idea'     ? 'Describe your project, or paste from another AI...'
                  : currentStage === 'features' ? 'Ask to add, remove, or change features...'
                  : currentStage === 'stack'    ? 'Ask about a stack option or describe your preference...'
                  : isComplete                  ? 'Ask a follow-up or refine...'
                  : 'Type a message...'
                }
                disabled={isTyping || isGenerating}
                rows={1}
                style={{
                  flex: 1, background: 'rgba(255,255,255,0.05)',
                  backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
                  padding: '10px 14px', fontSize: 13, color: '#fff',
                  outline: 'none', resize: 'none', minHeight: 42, maxHeight: 120,
                  lineHeight: 1.5, fontFamily: 'inherit', transition: 'border-color 0.2s, box-shadow 0.2s',
                  opacity: (isTyping || isGenerating) ? 0.5 : 1,
                }}
                onFocus={e => { e.currentTarget.style.borderColor = ac; e.currentTarget.style.boxShadow = `0 0 0 3px ${hexToRgba(ac, 0.1)}` }}
                onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.boxShadow = 'none' }}
              />
              <button onClick={() => handleSendMessage()} disabled={isTyping || isGenerating || !inputMsg.trim()} style={{
                width: 42, height: 42, borderRadius: 10, background: ac, border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                opacity: (isTyping || isGenerating || !inputMsg.trim()) ? 0.3 : 1, transition: 'opacity 0.15s',
              }}>
                <ArrowUp size={16} color="#000" />
              </button>
            </div>
            <div style={{ fontSize: 10, marginTop: 5, color: 'rgba(255,255,255,0.12)', textAlign: 'center' }}>
              Enter to send · Shift+Enter new line
            </div>
          </div>
        )}

        {/* Generating footer */}
        {isGeneratingStage && (
          <div style={{
            borderTop: '1px solid rgba(255,255,255,0.08)', padding: '16px 20px', flexShrink: 0,
            background: 'rgba(8,8,20,0.6)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: ac, animation: 'wPulse 1s infinite' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: ac, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {genCurrentStep >= 0 && GENERATION_STEPS[genCurrentStep] ? GENERATION_STEPS[genCurrentStep].label : 'Generating blueprint...'}
            </span>
          </div>
        )}
      </div>

      {/* ══ DRAG HANDLE ════════════════════════════════════════════════════════ */}
      <div onMouseDown={onDragStart} style={{
        width: 4, flexShrink: 0, cursor: 'col-resize',
        background: 'transparent', position: 'relative', zIndex: 10, transition: 'background 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = hexToRgba(ac, 0.3) }}
      onMouseLeave={e => { if (!isDragging.current) e.currentTarget.style.background = 'transparent' }}
      >
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', display: 'flex', flexDirection: 'column', gap: 3 }}>
          {[0,1,2,3,4].map(i => <div key={i} style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(255,255,255,0.2)' }} />)}
        </div>
      </div>

      {/* ══ RIGHT PANEL ════════════════════════════════════════════════════════ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <StageProgress currentStage={currentStage} completedStages={completedStages} accent={ac} />

        {/* Tab bar — only on complete */}
        {rightPanelMode === 'complete' && (
          <div style={{
            height: 44, borderBottom: '1px solid rgba(255,255,255,0.07)',
            background: 'rgba(255,255,255,0.02)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', flexShrink: 0,
          }}>
            <div style={{ display: 'flex', gap: 0 }}>
              {(['preview', 'files'] as const).map(tab => (
                <button key={tab} onClick={() => setRightTab(tab)} style={{
                  padding: '6px 14px', fontSize: 11, fontWeight: 600, border: 'none', background: 'transparent',
                  borderBottom: `2px solid ${rightTab === tab ? ac : 'transparent'}`,
                  color: rightTab === tab ? ac : 'rgba(255,255,255,0.35)', cursor: 'pointer', transition: 'all 0.15s',
                }}>{tab === 'preview' ? 'Preview' : 'Files'}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {isSupported && generatedBlueprint?.markdownFiles && (
                <button onClick={() => setShowInjectModal(true)} style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px',
                  background: hexToRgba(ac, 0.1), border: `1px solid ${hexToRgba(ac, 0.25)}`,
                  borderRadius: 7, cursor: 'pointer', fontSize: 10, fontWeight: 700, color: ac, transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = hexToRgba(ac, 0.18) }}
                onMouseLeave={e => { e.currentTarget.style.background = hexToRgba(ac, 0.1) }}
                >
                  <FolderOpen size={12} /> Inject files
                </button>
              )}
              {generatedBlueprint?.markdownFiles && (
                <button onClick={handleExportZip} style={{
                  display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px',
                  background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 7, cursor: 'pointer', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = ac; e.currentTarget.style.color = ac }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'rgba(255,255,255,0.4)' }}
                >
                  ↓ Export ZIP
                </button>
              )}
            </div>
          </div>
        )}

        {/* Right panel content */}
        <div ref={rightPanelRef} style={{ flex: 1, overflowY: 'auto', background: 'rgba(255,255,255,0.005)' }}>

          {/* Hint — idea stage */}
          {rightPanelMode === 'hint' && (
            <div style={{ padding: 20 }}>
              <div style={glassCard({ padding: '16px 18px' })}>
                <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', color: ac, textTransform: 'uppercase', marginBottom: 6 }}>
                  {STAGE_META[currentStage]?.label}
                </div>
                <div style={{ fontSize: 13, color: '#fff', fontWeight: 600, marginBottom: 4 }}>Tell me about your project idea</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>{STAGE_META[currentStage]?.description}</div>
              </div>
            </div>
          )}

          {/* Interactive features — features stage */}
          {rightPanelMode === 'features' && (
            <div style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: 2 }}>
                    Feature Set
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                    {confirmedCount} of {pendingFeatures.length} selected · Drag to reorder · Click to edit
                  </div>
                </div>
                <button onClick={handleFeatureAdd} style={{
                  display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px',
                  background: hexToRgba(ac, 0.1), border: `1px solid ${hexToRgba(ac, 0.22)}`,
                  borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: 700, color: ac,
                }}>
                  <Plus size={12} /> Add
                </button>
              </div>

              {pendingFeatures.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 16px', fontSize: 13, color: 'rgba(255,255,255,0.25)', lineHeight: 1.6 }}>
                  No features yet.<br />Chat with the AI or click Add above.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {pendingFeatures.map((f, i) => (
                    <div key={i} draggable onDragStart={() => handleDragStart(i)} onDragOver={handleDragOver} onDrop={() => handleDrop(i)}>
                      <FeatureCard
                        feature={f} accent={ac}
                        onToggle={() => handleFeatureToggle(i)}
                        onEdit={(field, value) => handleFeatureEdit(i, field, value)}
                        onRemove={() => handleFeatureRemove(i)}
                      />
                    </div>
                  ))}
                </div>
              )}

              {pendingFeatures.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <button onClick={handleConfirmFeatures} style={{
                    width: '100%', padding: '11px', background: ac, border: 'none',
                    borderRadius: 10, cursor: 'pointer', fontSize: 12, fontWeight: 800, color: '#000',
                    boxShadow: `0 0 20px ${hexToRgba(ac, 0.3)}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}>
                    <Check size={14} /> Confirm Features →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Stack cards — stack stage */}
          {rightPanelMode === 'stacks' && (
            <div style={{ padding: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: 4 }}>
                Choose Your Tech Stack
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginBottom: 16, lineHeight: 1.5 }}>
                {stackOptions.length > 0 ? 'Select an option — or ask about it in chat.' : 'Stack options appear here once the AI generates them.'}
              </div>
              {stackOptions.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {stackOptions.map(opt => (
                    <TechStackCard key={opt.id} option={opt} selected={pendingStack?.id === opt.id} onSelect={() => handleSelectStack(opt)} accent={ac} />
                  ))}
                </div>
              ) : (
                <div style={{ ...glassCard({ padding: 24 }), textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>⟳</div>
                  Stack options loading via chat...
                </div>
              )}
              {pendingStack && !isGenerating && (
                <div style={{ marginTop: 16 }}>
                  <button onClick={() => handleGenerate(0)} style={{
                    width: '100%', padding: '11px', background: ac, border: 'none',
                    borderRadius: 10, cursor: 'pointer', fontSize: 12, fontWeight: 800, color: '#000',
                    boxShadow: `0 0 20px ${hexToRgba(ac, 0.3)}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}>
                    <Sparkles size={14} /> Generate Blueprint
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Generation progress */}
          {rightPanelMode === 'generating' && (
            <GenerationProgress steps={GENERATION_STEPS} currentStep={genCurrentStep} completedSteps={genCompletedSteps} errorStep={genErrorStep} accent={ac} />
          )}

          {/* Complete — preview tab */}
          {rightPanelMode === 'complete' && rightTab === 'preview' && generatedBlueprint && (
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={glassCard({ padding: '16px 18px' })}>
                <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', color: ac, textTransform: 'uppercase', marginBottom: 8 }}>Architecture Overview</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, maxHeight: 160, overflowY: 'auto' }}>
                  {generatedBlueprint.architecture?.slice(0, 500) ?? 'Architecture generated.'}
                  {(generatedBlueprint.architecture?.length ?? 0) > 500 ? '...' : ''}
                </div>
              </div>
              {generatedBlueprint.techStack && (
                <div style={glassCard({ padding: '14px 16px' })}>
                  <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: 10 }}>Tech Stack</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px' }}>
                    {Object.entries(generatedBlueprint.techStack).map(([k, v]) => (
                      <div key={k}>
                        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{k}</div>
                        <div style={{ fontSize: 11, color: '#fff', fontWeight: 500 }}>{v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {generatedBlueprint.phases && (
                <div>
                  <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: 10 }}>
                    Phases ({generatedBlueprint.phases.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {generatedBlueprint.phases.map((phase, i) => (
                      <div key={i} style={glassCard({ padding: '12px 14px' })}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{phase.name}</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>{phase.description}</div>
                        {phase.features && <div style={{ marginTop: 8, fontSize: 10, color: ac, fontWeight: 600 }}>{phase.features.length} feature{phase.features.length !== 1 ? 's' : ''}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Complete — files tab */}
          {rightPanelMode === 'complete' && rightTab === 'files' && generatedBlueprint?.markdownFiles && (
            <div style={{ padding: 20 }}>
              <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: 12 }}>
                Generated Files ({Object.keys(generatedBlueprint.markdownFiles).length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {Object.entries(generatedBlueprint.markdownFiles).map(([path, content]) => {
                  const sizeKb = (new TextEncoder().encode(content as string).length / 1024).toFixed(1)
                  return (
                    <div key={path} style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8,
                      background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                    }}>
                      <FileText size={12} color="rgba(255,255,255,0.3)" />
                      <span style={{ flex: 1, fontSize: 11, fontFamily: 'monospace', color: 'rgba(255,255,255,0.6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{path}</span>
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', flexShrink: 0 }}>{sizeKb}kb</span>
                    </div>
                  )
                })}
              </div>

              {/* Inject to local folder */}
              {isConnected && (
                <button
                  onClick={async () => {
                    if (!generatedBlueprint?.markdownFiles) return
                    try {
                      const written = await pushToLocal(generatedBlueprint.markdownFiles)
                      if (written > 0) {
                        localStorage.setItem(`blueprint_synced_${projectId}`, new Date().toISOString())
                        toast.success(`${written} files written to folder`)
                      }
                    } catch { toast.error('Inject failed') }
                  }}
                  style={{
                    marginTop: 12, width: '100%',
                    background: '#10b981', color: '#000',
                    border: 'none', borderRadius: 10,
                    padding: '11px',
                    fontSize: 11, fontWeight: 800,
                    letterSpacing: '0.1em', textTransform: 'uppercase',
                    cursor: 'pointer',
                  }}
                >
                  ↑ Inject to Local Folder
                </button>
              )}

              <button
                onClick={handleExportZip}
                style={{
                  marginTop: 8, width: '100%',
                  background: 'transparent', color: ac,
                  border: `1px solid ${hexToRgba(ac, 0.3)}`,
                  borderRadius: 10,
                  padding: '10px',
                  fontSize: 11, fontWeight: 800,
                  letterSpacing: '0.1em', textTransform: 'uppercase',
                  cursor: 'pointer',
                }}
              >
                ↓ Export All as ZIP
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ══ MODALS ══════════════════════════════════════════════════════════════ */}
      {showInjectModal && generatedBlueprint?.markdownFiles && (
        <InjectModal
          files={generatedBlueprint.markdownFiles as Record<string, string>}
          folderName={folderName} isConnected={isConnected}
          onConnect={openFolder} onConfirm={handleInjectFiles}
          onClose={() => setShowInjectModal(false)} accent={ac}
        />
      )}
      {showRegenConfirm && (
        <div
          onClick={() => setShowRegenConfirm(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 420, background: 'rgba(10,10,24,0.98)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: 28, display: 'flex', flexDirection: 'column', gap: 16 }}
          >
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Regenerate blueprint?</div>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', margin: 0, lineHeight: 1.6 }}>
              This will replace all existing phases, features, and prompts for this project.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowRegenConfirm(false)} style={{ flex: 1, padding: '10px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, background: 'transparent', color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                Cancel
              </button>
              <button
                onClick={() => { setShowRegenConfirm(false); handleGenerate(0) }}
                style={{ flex: 2, padding: '10px', background: ac, color: '#000', border: 'none', borderRadius: 8, fontSize: 11, fontWeight: 800, cursor: 'pointer' }}
              >
                Regenerate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

