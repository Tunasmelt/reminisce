'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/hooks/useTheme'
import {
  X, Bot, Trash2, Check, Pencil, Layers, Box,
} from 'lucide-react'
import { PriorityBadge, ProgressRing } from './StatusBadge'
import { STATUS_CONFIG, FEATURE_TYPE_CONFIG } from './types'
import type { Phase, Feature, StatusKey, FeatureType } from './types'

// ─────────────────────────────────────────────────────────
//  DetailPanel
//
//  Right-side slide-in panel for inspecting and editing
//  a selected phase or feature node.
//
//  Used by: graph page (absolute overlay), board page (fixed panel).
//
//  Props:
//    type          — 'phase' | 'feature'
//    itemId        — DB id of the selected phase or feature
//    projectId     — for Run Agent navigation
//    phases        — full phase list (for feature's phase label)
//    features      — full feature list (for phase completion stats)
//    onClose       — dismiss the panel
//    onUpdatePhase — (id, updates) => Promise<void>
//    onDeletePhase — (id) => Promise<void>
//    onUpdateFeature — (id, updates) => Promise<void>
//    onDeleteFeature — (id) => Promise<void>
// ─────────────────────────────────────────────────────────

interface DetailPanelProps {
  type: 'phase' | 'feature'
  itemId: string
  projectId: string
  phases: Phase[]
  features: Feature[]
  onClose: () => void
  onUpdatePhase: (
    id: string,
    updates: Partial<Pick<Phase, 'name' | 'description' | 'status'>>
  ) => Promise<void>
  onDeletePhase: (id: string) => Promise<void>
  onUpdateFeature: (
    id: string,
    updates: Partial<Pick<Feature, 'name' | 'description' | 'status' | 'type' | 'priority'>>
  ) => Promise<void>
  onDeleteFeature: (id: string) => Promise<void>
}

function hexToRgba(hex: string, a: number) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

const FEATURE_TYPES: FeatureType[] = [
  'frontend', 'backend', 'database', 'testing', 'architecture',
]

// ── Inline editable text field ────────────────────────────

interface InlineEditProps {
  value: string
  onSave: (val: string) => Promise<void>
  placeholder?: string
  multiline?: boolean
  fontSize?: number
  fontWeight?: number
  color?: string
  accent: string
}

function InlineEdit({
  value,
  onSave,
  placeholder = 'Click to edit...',
  multiline = false,
  fontSize = 13,
  fontWeight = 400,
  color = 'rgba(255,255,255,0.7)',
  accent,
}: InlineEditProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [saving, setSaving] = useState(false)
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null)

  // Sync if value changes externally
  useEffect(() => {
    if (!editing) setDraft(value)
  }, [value, editing])

  const handleEdit = () => {
    setDraft(value)
    setEditing(true)
    setTimeout(() => ref.current?.focus(), 0)
  }

  const handleSave = async () => {
    const trimmed = draft.trim()
    if (!trimmed || trimmed === value) {
      setEditing(false)
      setDraft(value)
      return
    }
    setSaving(true)
    try {
      await onSave(trimmed)
    } finally {
      setSaving(false)
      setEditing(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !multiline) {
      e.preventDefault()
      handleSave()
    }
    if (e.key === 'Escape') {
      setEditing(false)
      setDraft(value)
    }
  }

  const sharedInputStyle: React.CSSProperties = {
    width: '100%',
    background: 'rgba(255,255,255,0.06)',
    border: `1px solid ${hexToRgba(accent, 0.35)}`,
    borderRadius: 8,
    padding: '7px 10px',
    fontSize,
    fontWeight,
    color: '#fff',
    outline: 'none',
    lineHeight: 1.6,
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    resize: 'none' as const,
  }

  if (editing) {
    return (
      <div style={{ position: 'relative' }}>
        {multiline ? (
          <textarea
            ref={ref as React.RefObject<HTMLTextAreaElement>}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
            rows={3}
            maxLength={300}
            style={sharedInputStyle}
          />
        ) : (
          <input
            ref={ref as React.RefObject<HTMLInputElement>}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
            maxLength={80}
            style={sharedInputStyle}
          />
        )}
        {saving && (
          <div style={{
            position: 'absolute', right: 8, top: '50%',
            transform: 'translateY(-50%)',
            fontSize: 10, color: accent,
          }}>
            saving...
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      onClick={handleEdit}
      title="Click to edit"
      style={{
        fontSize,
        fontWeight,
        color: value ? color : 'rgba(255,255,255,0.2)',
        lineHeight: 1.6,
        cursor: 'text',
        padding: '4px 6px',
        borderRadius: 6,
        border: '1px solid transparent',
        transition: 'all 0.15s',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 6,
        wordBreak: 'break-word',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.borderColor = 'transparent'
      }}
    >
      <span style={{ flex: 1 }}>
        {value || placeholder}
      </span>
      <Pencil
        size={10}
        style={{
          color: 'rgba(255,255,255,0.2)',
          flexShrink: 0,
          marginTop: 3,
        }}
      />
    </div>
  )
}

// ── Main DetailPanel ──────────────────────────────────────

export function DetailPanel({
  type,
  itemId,
  projectId,
  phases,
  features,
  onClose,
  onUpdatePhase,
  onDeletePhase,
  onUpdateFeature,
  onDeleteFeature,
}: DetailPanelProps) {
  const { accent } = useTheme()
  const router = useRouter()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Derive the live item from props so it updates on optimistic changes
  const phase = type === 'phase'
    ? phases.find(p => p.id === itemId) ?? null
    : null

  const feature = type === 'feature'
    ? features.find(f => f.id === itemId) ?? null
    : null

  const item = phase ?? feature

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (confirmDelete) {
          setConfirmDelete(false)
        } else {
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, confirmDelete])

  // Reset confirm delete when item changes
  useEffect(() => {
    setConfirmDelete(false)
  }, [itemId])

  if (!item) return null

  // ── Phase stats ─────────────────────────────────────────

  const phaseFeatures = phase
    ? features.filter(f => f.phase_id === phase.id)
    : feature
    ? features.filter(f => f.phase_id === feature.phase_id)
    : []

  const doneCount = phaseFeatures.filter(
    f => f.status === 'done' || f.status === 'complete'
  ).length

  const parentPhase = feature
    ? phases.find(p => p.id === feature.phase_id)
    : null

  // ── Handlers ────────────────────────────────────────────

  const handleDelete = async () => {
    setDeleting(true)
    try {
      if (type === 'phase') {
        await onDeletePhase(itemId)
      } else {
        await onDeleteFeature(itemId)
      }
      onClose()
    } finally {
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  const sectionLabel: React.CSSProperties = {
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.28)',
    marginBottom: 8,
    display: 'block',
  }

  const divider: React.CSSProperties = {
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    margin: '18px 0',
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 0, right: 0, bottom: 0,
        width: 320,
        background: 'rgba(8,8,20,0.97)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderLeft: '1px solid rgba(255,255,255,0.09)',
        zIndex: 20,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '-8px 0 40px rgba(0,0,0,0.5)',
        animation: 'slideInRight 0.2s ease',
      }}
    >
      {/* ── Header ─────────────────────────────────────── */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          background: 'rgba(255,255,255,0.02)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: type === 'phase'
                ? 'rgba(59,130,246,0.12)'
                : 'rgba(139,92,246,0.12)',
              border: `1px solid ${type === 'phase'
                ? 'rgba(59,130,246,0.25)'
                : 'rgba(139,92,246,0.25)'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {type === 'phase'
              ? <Layers size={14} color="#60a5fa" />
              : <Box size={14} color="#a78bfa" />
            }
          </div>
          <div>
            <div style={{
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: type === 'phase'
                ? '#60a5fa'
                : '#a78bfa',
            }}>
              {type === 'phase' ? 'Phase' : 'Feature'}
            </div>
            <div style={{
              fontSize: 11,
              color: 'rgba(255,255,255,0.3)',
              marginTop: 1,
            }}>
              Click any field to edit
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            width: 28, height: 28,
            borderRadius: 7,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.09)',
            color: 'rgba(255,255,255,0.4)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s',
            flexShrink: 0,
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.1)'
            e.currentTarget.style.color = '#fff'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
            e.currentTarget.style.color = 'rgba(255,255,255,0.4)'
          }}
        >
          <X size={13} />
        </button>
      </div>

      {/* ── Scrollable body ────────────────────────────── */}
      <div
        style={{ flex: 1, overflowY: 'auto', padding: '18px 20px' }}
        className="hide-scrollbar"
      >
        {/* Name */}
        <div style={{ marginBottom: 16 }}>
          <span style={sectionLabel}>Name</span>
          <InlineEdit
            value={item.name}
            onSave={val =>
              type === 'phase'
                ? onUpdatePhase(itemId, { name: val })
                : onUpdateFeature(itemId, { name: val })
            }
            placeholder="Unnamed"
            fontSize={15}
            fontWeight={700}
            color="#fff"
            accent={accent}
          />
        </div>

        {/* Description */}
        <div style={{ marginBottom: 16 }}>
          <span style={sectionLabel}>Description</span>
          <InlineEdit
            value={item.description ?? ''}
            onSave={val =>
              type === 'phase'
                ? onUpdatePhase(itemId, { description: val })
                : onUpdateFeature(itemId, { description: val })
            }
            placeholder="Add a description..."
            multiline
            fontSize={12}
            color="rgba(255,255,255,0.55)"
            accent={accent}
          />
        </div>

        <div style={divider} />

        {/* Status */}
        <div style={{ marginBottom: 16 }}>
          <span style={sectionLabel}>Status</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {Object.entries(STATUS_CONFIG)
              // Don't show 'complete' since it's an alias for 'done'
              .filter(([key]) => key !== 'complete')
              .map(([key, cfg]) => {
                const isSelected = item.status === key ||
                  (key === 'done' && item.status === 'complete')
                return (
                  <button
                    key={key}
                    onClick={() =>
                      type === 'phase'
                        ? onUpdatePhase(itemId, { status: key as StatusKey })
                        : onUpdateFeature(itemId, { status: key as StatusKey })
                    }
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 9,
                      padding: '8px 12px',
                      borderRadius: 9,
                      border: `1px solid ${isSelected
                        ? cfg.border
                        : 'rgba(255,255,255,0.06)'}`,
                      background: isSelected
                        ? cfg.bg
                        : 'rgba(255,255,255,0.02)',
                      color: isSelected ? cfg.color : 'rgba(255,255,255,0.5)',
                      fontSize: 12,
                      fontWeight: isSelected ? 700 : 400,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.12s',
                      width: '100%',
                    }}
                    onMouseEnter={e => {
                      if (!isSelected) {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                        e.currentTarget.style.color = '#fff'
                      }
                    }}
                    onMouseLeave={e => {
                      if (!isSelected) {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.02)'
                        e.currentTarget.style.color = 'rgba(255,255,255,0.5)'
                      }
                    }}
                  >
                    <span style={{
                      width: 8, height: 8,
                      borderRadius: '50%',
                      background: cfg.color,
                      flexShrink: 0,
                    }} />
                    {cfg.label}
                    {isSelected && (
                      <Check size={12} style={{ marginLeft: 'auto', color: cfg.color }} />
                    )}
                  </button>
                )
              })}
          </div>
        </div>

        <div style={divider} />

        {/* Phase-specific: progress ring + feature list */}
        {type === 'phase' && phase && (
          <div style={{ marginBottom: 16 }}>
            <span style={sectionLabel}>Progress</span>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '12px 14px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 12,
              marginBottom: 12,
            }}>
              <ProgressRing
                total={phaseFeatures.length}
                done={doneCount}
                size={40}
                color="#34d399"
              />
              <div>
                <div style={{
                  fontSize: 15,
                  fontWeight: 800,
                  color: '#fff',
                  lineHeight: 1,
                  marginBottom: 3,
                }}>
                  {doneCount}/{phaseFeatures.length}
                </div>
                <div style={{
                  fontSize: 10,
                  color: 'rgba(255,255,255,0.3)',
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}>
                  features done
                </div>
              </div>
            </div>

            {/* Feature list under phase */}
            {phaseFeatures.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {phaseFeatures.map(f => {
                  const sCfg = STATUS_CONFIG[f.status] ?? STATUS_CONFIG['planned']
                  return (
                    <div key={f.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '7px 10px',
                      borderRadius: 8,
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.06)',
                    }}>
                      <span style={{
                        width: 6, height: 6,
                        borderRadius: '50%',
                        background: sCfg.color,
                        flexShrink: 0,
                      }} />
                      <span style={{
                        flex: 1,
                        fontSize: 11,
                        color: 'rgba(255,255,255,0.65)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {f.name}
                      </span>
                      <PriorityBadge priority={f.priority} />
                    </div>
                  )
                })}
              </div>
            )}

            {phaseFeatures.length === 0 && (
              <div style={{
                fontSize: 11,
                color: 'rgba(255,255,255,0.2)',
                fontStyle: 'italic',
                padding: '8px 0',
              }}>
                No features in this phase yet.
              </div>
            )}
          </div>
        )}

        {/* Feature-specific: type selector, priority, parent phase */}
        {type === 'feature' && feature && (
          <>
            {/* Parent phase label */}
            {parentPhase && (
              <div style={{ marginBottom: 14 }}>
                <span style={sectionLabel}>Phase</span>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  padding: '7px 10px',
                  background: 'rgba(59,130,246,0.06)',
                  border: '1px solid rgba(59,130,246,0.15)',
                  borderRadius: 8,
                }}>
                  <Layers size={11} color="#60a5fa" />
                  <span style={{
                    fontSize: 12,
                    color: '#60a5fa',
                    fontWeight: 600,
                  }}>
                    {parentPhase.name}
                  </span>
                </div>
              </div>
            )}

            {/* Type selector */}
            <div style={{ marginBottom: 14 }}>
              <span style={sectionLabel}>Type</span>
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 6,
              }}>
                {FEATURE_TYPES.map(t => {
                  const tCfg = FEATURE_TYPE_CONFIG[t] ?? { label: t, color: '#fff' }
                  const isSelected = feature.type === t
                  return (
                    <button
                      key={t}
                      onClick={() => onUpdateFeature(itemId, { type: t })}
                      style={{
                        padding: '5px 12px',
                        borderRadius: 999,
                        border: `1px solid ${isSelected
                          ? tCfg.color + '50'
                          : 'rgba(255,255,255,0.08)'}`,
                        background: isSelected
                          ? tCfg.color + '18'
                          : 'transparent',
                        color: isSelected
                          ? tCfg.color
                          : 'rgba(255,255,255,0.4)',
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        cursor: 'pointer',
                        transition: 'all 0.12s',
                      }}
                    >
                      {tCfg.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Priority */}
            <div style={{ marginBottom: 14 }}>
              <span style={sectionLabel}>Priority</span>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                <input
                  type="number"
                  min={1}
                  max={999}
                  value={feature.priority}
                  onChange={async e => {
                    const val = parseInt(e.target.value)
                    if (!isNaN(val) && val > 0) {
                      await onUpdateFeature(itemId, { priority: val })
                    }
                  }}
                  style={{
                    width: 72,
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    padding: '7px 10px',
                    fontSize: 13,
                    fontWeight: 700,
                    color: '#fff',
                    outline: 'none',
                    fontFamily: 'ui-monospace, monospace',
                    boxSizing: 'border-box',
                  }}
                />
                <span style={{
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.25)',
                }}>
                  lower = higher priority
                </span>
              </div>
            </div>

            <div style={divider} />

            {/* Progress in parent phase */}
            <div style={{ marginBottom: 14 }}>
              <span style={sectionLabel}>Phase Progress</span>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 12px',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 10,
              }}>
                <ProgressRing
                  total={phaseFeatures.length}
                  done={doneCount}
                  size={32}
                  color="#34d399"
                />
                <div style={{
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.4)',
                }}>
                  {doneCount}/{phaseFeatures.length} features done
                  in this phase
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Footer ─────────────────────────────────────── */}
      <div
        style={{
          padding: '14px 20px',
          borderTop: '1px solid rgba(255,255,255,0.07)',
          background: 'rgba(255,255,255,0.01)',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {/* Run Agent — features only */}
        {type === 'feature' && feature && (
          <button
            onClick={() =>
              router.push(
                `/dashboard/projects/${projectId}/agent?featureId=${feature.id}`
              )
            }
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
              padding: '11px',
              background: hexToRgba(accent, 1),
              color: '#000',
              border: 'none',
              borderRadius: 10,
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: '0.05em',
              cursor: 'pointer',
              transition: 'all 0.15s',
              boxShadow: `0 0 20px ${hexToRgba(accent, 0.3)}`,
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            <Bot size={14} />
            Run Agent on this Feature
          </button>
        )}

        {/* Delete — with confirmation */}
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '9px',
              background: 'transparent',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 10,
              color: 'rgba(239,68,68,0.6)',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = '#ef4444'
              e.currentTarget.style.color = '#ef4444'
              e.currentTarget.style.background = 'rgba(239,68,68,0.06)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'rgba(239,68,68,0.2)'
              e.currentTarget.style.color = 'rgba(239,68,68,0.6)'
              e.currentTarget.style.background = 'transparent'
            }}
          >
            <Trash2 size={12} />
            Delete {type === 'phase' ? 'Phase' : 'Feature'}
            {type === 'phase' && (
              <span style={{
                fontSize: 9,
                color: 'rgba(239,68,68,0.4)',
                fontWeight: 500,
              }}>
                (+ all features)
              </span>
            )}
          </button>
        ) : (
          <div style={{
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.25)',
            borderRadius: 10,
            padding: '12px',
          }}>
            <div style={{
              fontSize: 11,
              color: 'rgba(255,255,255,0.6)',
              marginBottom: 10,
              textAlign: 'center',
              lineHeight: 1.5,
            }}>
              {type === 'phase'
                ? 'Delete this phase and all its features?'
                : 'Delete this feature permanently?'}
              <br />
              <span style={{ color: '#f87171', fontWeight: 600 }}>
                This cannot be undone.
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
                style={{
                  flex: 1,
                  padding: '8px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  color: 'rgba(255,255,255,0.5)',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{
                  flex: 1,
                  padding: '8px',
                  background: deleting
                    ? 'rgba(239,68,68,0.2)'
                    : '#ef4444',
                  border: 'none',
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {deleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
