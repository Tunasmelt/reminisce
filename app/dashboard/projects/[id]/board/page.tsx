'use client'

import { useState, useCallback, useRef, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { useTheme } from '@/hooks/useTheme'
import { Plus, GitBranch, X, ChevronDown } from 'lucide-react'
import { useProjectData } from '../graph/useProjectData'
import { DetailPanel } from '../graph/DetailPanel'
import { AddFeatureModal } from '../graph/AddFeatureModal'
import { FeatureTypeBadge, PriorityBadge } from '../graph/StatusBadge'
import { BOARD_COLUMNS, normalizeStatus } from '../graph/types'
import type { Feature, StatusKey } from '../graph/types'

// ─────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────

function hexToRgba(hex: string, a: number) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

// ─────────────────────────────────────────────────────────
//  Board Page
// ─────────────────────────────────────────────────────────

export default function BoardPage() {
  const params = useParams()
  const projectId = params.id as string
  const { accent } = useTheme()

  const {
    project, phases, features, loading,
    createFeature, updateFeature, deleteFeature,
    updatePhase, deletePhase,
    setFeatureStatus, reorderFeaturePriority,
  } = useProjectData(projectId)

  // ── UI state ───────────────────────────────────────────
  const [filterPhaseId, setFilterPhaseId] = useState<string>('ALL')
  const [showPhaseFilter, setShowPhaseFilter] = useState(false)

  // Detail panel
  const [panelType, setPanelType] = useState<'phase' | 'feature' | null>(null)
  const [panelId, setPanelId] = useState<string | null>(null)

  // Add feature modal
  const [showAddFeature, setShowAddFeature] = useState(false)
  const [addFeatureDefaultPhase, setAddFeatureDefaultPhase] = useState<string>('')
  const [addFeatureDefaultStatus, setAddFeatureDefaultStatus] = useState<StatusKey>('planned')
  const [modalSaving, setModalSaving] = useState(false)

  // Quick-add inline state per column
  const [quickAddCol, setQuickAddCol] = useState<StatusKey | null>(null)
  const [quickAddName, setQuickAddName] = useState('')
  const [quickAddPhaseId, setQuickAddPhaseId] = useState('')
  const [quickAddSaving, setQuickAddSaving] = useState(false)

  // ── Drag state (native HTML5 DnD) ─────────────────────
  const dragFeatureId = useRef<string | null>(null)
  const dragOverCol = useRef<StatusKey | null>(null)
  const dragOverFeatureId = useRef<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropTargetCol, setDropTargetCol] = useState<StatusKey | null>(null)
  const [dropTargetFeatureId, setDropTargetFeatureId] = useState<string | null>(null)

  // ── Filtered features ─────────────────────────────────

  const visibleFeatures = useMemo(() => {
    if (filterPhaseId === 'ALL') return features
    return features.filter(f => f.phase_id === filterPhaseId)
  }, [features, filterPhaseId])

  const getFeaturesForColumn = useCallback((status: StatusKey) => {
    return visibleFeatures
      .filter(f => {
        const norm = normalizeStatus(f.status)
        return norm === status
      })
      .sort((a, b) => a.priority - b.priority)
  }, [visibleFeatures])

  // ── Drag handlers ─────────────────────────────────────

  const handleDragStart = useCallback((
    e: React.DragEvent,
    featureId: string
  ) => {
    dragFeatureId.current = featureId
    setDraggingId(featureId)
    e.dataTransfer.effectAllowed = 'move'
    // Transparent drag image so card stays visible
    const ghost = document.createElement('div')
    ghost.style.position = 'absolute'
    ghost.style.top = '-9999px'
    document.body.appendChild(ghost)
    e.dataTransfer.setDragImage(ghost, 0, 0)
    setTimeout(() => document.body.removeChild(ghost), 0)
  }, [])

  const handleDragEnd = useCallback(async () => {
    const fId = dragFeatureId.current
    const targetCol = dragOverCol.current
    const targetFeatId = dragOverFeatureId.current

    setDraggingId(null)
    setDropTargetCol(null)
    setDropTargetFeatureId(null)
    dragFeatureId.current = null
    dragOverCol.current = null
    dragOverFeatureId.current = null

    if (!fId || !targetCol) return

    const dragged = features.find(f => f.id === fId)
    if (!dragged) return

    const currentStatus = normalizeStatus(dragged.status)

    if (currentStatus !== targetCol) {
      // Moving to a different column — status change only
      await setFeatureStatus(fId, targetCol)
    } else if (targetFeatId && targetFeatId !== fId) {
      // Reordering within the same column
      const colFeatures = getFeaturesForColumn(targetCol)
      const ids = colFeatures.map(f => f.id)
      const fromIdx = ids.indexOf(fId)
      const toIdx = ids.indexOf(targetFeatId)
      if (fromIdx !== -1 && toIdx !== -1 && fromIdx !== toIdx) {
        // Remove from current position, insert at target
        ids.splice(fromIdx, 1)
        ids.splice(toIdx, 0, fId)
        await reorderFeaturePriority(dragged.phase_id, ids)
      }
    }
  }, [features, setFeatureStatus, reorderFeaturePriority, getFeaturesForColumn])

  const handleColumnDragOver = useCallback((
    e: React.DragEvent,
    colStatus: StatusKey
  ) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    dragOverCol.current = colStatus
    dragOverFeatureId.current = null
    setDropTargetCol(colStatus)
    setDropTargetFeatureId(null)
  }, [])

  const handleFeatureDragOver = useCallback((
    e: React.DragEvent,
    colStatus: StatusKey,
    featureId: string
  ) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    dragOverCol.current = colStatus
    dragOverFeatureId.current = featureId
    setDropTargetCol(colStatus)
    setDropTargetFeatureId(featureId)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    // actual logic runs in handleDragEnd
  }, [])

  // ── Quick-add handlers ────────────────────────────────

  const openQuickAdd = (status: StatusKey) => {
    setQuickAddCol(status)
    setQuickAddName('')
    setQuickAddPhaseId(phases[0]?.id ?? '')
    setTimeout(() => {
      document.getElementById('quick-add-input')?.focus()
    }, 50)
  }

  const submitQuickAdd = async () => {
    if (!quickAddName.trim() || !quickAddPhaseId || quickAddSaving) return
    setQuickAddSaving(true)
    const result = await createFeature({
      name: quickAddName.trim(),
      description: '',
      type: 'frontend',
      phaseId: quickAddPhaseId,
    })
    if (result) {
      // Set its status to the target column
      if (quickAddCol && quickAddCol !== 'planned') {
        await setFeatureStatus(result.id, quickAddCol)
      }
      setQuickAddName('')
      setQuickAddCol(null)
    }
    setQuickAddSaving(false)
  }

  // ── Add feature modal ────────────────────────────────

  const handleOpenAddFeature = (status: StatusKey) => {
    setAddFeatureDefaultStatus(status)
    setAddFeatureDefaultPhase(phases[0]?.id ?? '')
    setShowAddFeature(true)
  }

  const handleCreateFeature = async (input: {
    name: string
    description: string
    type: string
    phaseId: string
  }) => {
    setModalSaving(true)
    const result = await createFeature({
      name: input.name,
      description: input.description,
      type: input.type,
      phaseId: input.phaseId,
    })
    if (result && addFeatureDefaultStatus !== 'planned') {
      await setFeatureStatus(result.id, addFeatureDefaultStatus)
    }
    setModalSaving(false)
    if (result) setShowAddFeature(false)
  }

  // ── Loading state ─────────────────────────────────────

  if (loading) return (
    <div style={{
      height: 'calc(100vh - 68px)',
      display: 'flex',
      gap: 12,
      padding: 20,
      background: '#07070f',
      overflow: 'hidden',
    }}>
      {BOARD_COLUMNS.map(col => (
        <div key={col.key} style={{
          flex: 1,
          background: 'rgba(255,255,255,0.03)',
          borderRadius: 14,
          animation: 'skeletonPulse 1.5s ease infinite',
        }} />
      ))}
    </div>
  )

  // ── Empty state ───────────────────────────────────────

  if (!loading && phases.length === 0) return (
    <div style={{
      height: 'calc(100vh - 68px)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      padding: 40,
      background: 'linear-gradient(160deg, rgba(var(--accent-rgb),0.04) 0%, transparent 50%), #07070f',
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: 16,
        background: hexToRgba(accent, 0.08),
        border: `1px solid ${hexToRgba(accent, 0.15)}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <GitBranch size={24} color={hexToRgba(accent, 0.5)} />
      </div>
      <div style={{ textAlign: 'center', maxWidth: 340 }}>
        <h3 style={{
          fontSize: 18, fontWeight: 800,
          color: '#fff', marginBottom: 8,
          letterSpacing: '-0.01em',
        }}>
          No phases yet
        </h3>
        <p style={{
          fontSize: 13,
          color: 'rgba(255,255,255,0.4)',
          lineHeight: 1.7, marginBottom: 20,
        }}>
          The board needs at least one phase with features.
          Run the Wizard or create phases in the Graph view first.
        </p>
        <a
          href={`/dashboard/projects/${projectId}/wizard`}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '10px 22px',
            background: accent, color: '#000',
            border: 'none', borderRadius: 10,
            fontSize: 12, fontWeight: 800,
            textDecoration: 'none',
            boxShadow: `0 0 20px ${hexToRgba(accent, 0.3)}`,
          }}
        >
          Open Wizard →
        </a>
      </div>
    </div>
  )

  // ── Phase filter label ────────────────────────────────

  const activePhaseLabel = filterPhaseId === 'ALL'
    ? 'All Phases'
    : phases.find(p => p.id === filterPhaseId)?.name ?? 'All Phases'

  // ── Main render ───────────────────────────────────────

  return (
    <div style={{
      height: 'calc(100vh - 68px)',
      display: 'flex',
      flexDirection: 'column',
      background: 'linear-gradient(160deg, rgba(var(--accent-rgb),0.04) 0%, transparent 50%), #07070f',
      overflow: 'hidden',
      position: 'relative',
    }}>
      <title>{`Reminisce — Board — ${project?.name}`}</title>

      {/* ── Top bar ────────────────────────────────────── */}
      <div style={{
        height: 52,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        gap: 12,
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        background: 'rgba(8,8,20,0.7)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        position: 'relative',
        zIndex: 10,
      }}>
        {/* Project name */}
        <div style={{
          fontSize: 12, fontWeight: 700,
          color: 'rgba(255,255,255,0.5)',
          letterSpacing: '0.04em',
        }}>
          {project?.name}
        </div>

        <div style={{
          width: 1, height: 16,
          background: 'rgba(255,255,255,0.1)',
        }} />

        {/* Phase filter */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowPhaseFilter(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 12px',
              background: filterPhaseId !== 'ALL'
                ? hexToRgba(accent, 0.1)
                : 'rgba(255,255,255,0.04)',
              border: `1px solid ${filterPhaseId !== 'ALL'
                ? hexToRgba(accent, 0.25)
                : 'rgba(255,255,255,0.09)'}`,
              borderRadius: 8,
              color: filterPhaseId !== 'ALL'
                ? accent
                : 'rgba(255,255,255,0.5)',
              fontSize: 11, fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            <GitBranch size={11} />
            {activePhaseLabel}
            <ChevronDown size={11} style={{
              transform: showPhaseFilter ? 'rotate(180deg)' : 'rotate(0)',
              transition: 'transform 0.15s',
            }} />
          </button>

          {showPhaseFilter && (
            <div style={{
              position: 'absolute',
              top: '100%', left: 0,
              marginTop: 6,
              minWidth: 200,
              background: 'rgba(10,10,24,0.98)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 12,
              overflow: 'hidden',
              boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
              zIndex: 50,
            }}>
              {[{ id: 'ALL', name: 'All Phases' }, ...phases].map(p => (
                <button
                  key={p.id}
                  onClick={() => {
                    setFilterPhaseId(p.id)
                    setShowPhaseFilter(false)
                  }}
                  style={{
                    width: '100%',
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '10px 14px',
                    background: filterPhaseId === p.id
                      ? hexToRgba(accent, 0.08)
                      : 'transparent',
                    border: 'none',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    color: filterPhaseId === p.id
                      ? accent
                      : 'rgba(255,255,255,0.6)',
                    fontSize: 12, fontWeight: 500,
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 0.1s',
                  }}
                  onMouseEnter={e => {
                    if (filterPhaseId !== p.id)
                      e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                  }}
                  onMouseLeave={e => {
                    if (filterPhaseId !== p.id)
                      e.currentTarget.style.background = 'transparent'
                  }}
                >
                  {filterPhaseId === p.id && (
                    <span style={{ color: accent, fontSize: 12 }}>✓</span>
                  )}
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Feature count */}
        <span style={{
          fontSize: 11,
          color: 'rgba(255,255,255,0.25)',
        }}>
          {visibleFeatures.length} feature{visibleFeatures.length !== 1 ? 's' : ''}
        </span>

        <div style={{ flex: 1 }} />

        {/* Clear filter */}
        {filterPhaseId !== 'ALL' && (
          <button
            onClick={() => setFilterPhaseId('ALL')}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 10px',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 7,
              color: 'rgba(255,255,255,0.35)',
              fontSize: 10, fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = '#fff'
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = 'rgba(255,255,255,0.35)'
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
            }}
          >
            <X size={10} /> Clear filter
          </button>
        )}

        {/* Graph link */}
        <a
          href={`/dashboard/projects/${projectId}/graph`}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '6px 14px',
            background: hexToRgba(accent, 0.08),
            border: `1px solid ${hexToRgba(accent, 0.2)}`,
            borderRadius: 8,
            color: accent,
            fontSize: 11, fontWeight: 700,
            textDecoration: 'none',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e =>
            e.currentTarget.style.background = hexToRgba(accent, 0.16)
          }
          onMouseLeave={e =>
            e.currentTarget.style.background = hexToRgba(accent, 0.08)
          }
        >
          <GitBranch size={11} /> Graph View
        </a>
      </div>

      {/* Close phase filter on outside click */}
      {showPhaseFilter && (
        <div
          onClick={() => setShowPhaseFilter(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9,
          }}
        />
      )}

      {/* ── Kanban columns ─────────────────────────────── */}
      <div style={{
        flex: 1,
        display: 'flex',
        gap: 10,
        padding: '14px 16px',
        overflowX: 'auto',
        overflowY: 'hidden',
      }}
        className="hide-scrollbar"
      >
        {BOARD_COLUMNS.map(col => {
          const colFeatures = getFeaturesForColumn(col.key)
          const isDropTarget = dropTargetCol === col.key && draggingId !== null
          const draggingFeature = draggingId
            ? features.find(f => f.id === draggingId)
            : null
          const wouldChangeStatus = draggingFeature
            ? normalizeStatus(draggingFeature.status) !== col.key
            : false

          return (
            <div
              key={col.key}
              onDragOver={e => handleColumnDragOver(e, col.key)}
              onDrop={handleDrop}
              style={{
                flex: '0 0 260px',
                display: 'flex',
                flexDirection: 'column',
                borderRadius: 14,
                background: isDropTarget && wouldChangeStatus
                  ? `${col.color}08`
                  : 'rgba(255,255,255,0.025)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: `1px solid ${isDropTarget && wouldChangeStatus
                  ? `${col.color}35`
                  : 'rgba(255,255,255,0.07)'}`,
                transition: 'all 0.15s ease',
                maxHeight: '100%',
                overflow: 'hidden',
              }}
            >
              {/* Column header */}
              <div style={{
                padding: '12px 14px 10px',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                borderBottom: '1px solid rgba(255,255,255,0.06)',
              }}>
                <span style={{
                  width: 8, height: 8,
                  borderRadius: '50%',
                  background: col.color,
                  flexShrink: 0,
                }} />
                <span style={{
                  fontSize: 10, fontWeight: 800,
                  color: 'rgba(255,255,255,0.7)',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  flex: 1,
                }}>
                  {col.label}
                </span>
                <span style={{
                  fontSize: 10, fontWeight: 700,
                  color: colFeatures.length > 0
                    ? col.color
                    : 'rgba(255,255,255,0.2)',
                  background: colFeatures.length > 0
                    ? `${col.color}15`
                    : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${colFeatures.length > 0
                    ? `${col.color}30`
                    : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 999,
                  padding: '1px 7px',
                  minWidth: 22,
                  textAlign: 'center',
                }}>
                  {colFeatures.length}
                </span>

                {/* Quick add button per column */}
                <button
                  onClick={() => handleOpenAddFeature(col.key)}
                  style={{
                    width: 22, height: 22,
                    display: 'flex', alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 6,
                    color: 'rgba(255,255,255,0.3)',
                    cursor: 'pointer',
                    flexShrink: 0,
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = `${col.color}15`
                    e.currentTarget.style.borderColor = `${col.color}30`
                    e.currentTarget.style.color = col.color
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
                    e.currentTarget.style.color = 'rgba(255,255,255,0.3)'
                  }}
                  title={`Add feature to ${col.label}`}
                >
                  <Plus size={11} />
                </button>
              </div>

              {/* Cards scroll area */}
              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '8px 8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
                className="hide-scrollbar"
              >
                {colFeatures.map(feature => (
                  <FeatureCard
                    key={feature.id}
                    feature={feature}
                    phases={phases}
                    colStatus={col.key}
                    colColor={col.color}
                    isDragging={draggingId === feature.id}
                    isDropTarget={dropTargetFeatureId === feature.id}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onDragOver={handleFeatureDragOver}
                    onDrop={handleDrop}
                    onClick={() => {
                      setPanelType('feature')
                      setPanelId(feature.id)
                    }}
                  />
                ))}

                {/* Drop zone indicator when dragging over empty column */}
                {isDropTarget && wouldChangeStatus && colFeatures.length === 0 && (
                  <div style={{
                    height: 60,
                    borderRadius: 10,
                    border: `2px dashed ${col.color}40`,
                    background: `${col.color}06`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                    color: `${col.color}80`,
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                  }}>
                    Drop here
                  </div>
                )}

                {/* Quick-add inline form */}
                {quickAddCol === col.key ? (
                  <div style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: `1px solid ${hexToRgba(accent, 0.3)}`,
                    borderRadius: 10,
                    padding: '10px 12px',
                  }}>
                    <input
                      id="quick-add-input"
                      value={quickAddName}
                      onChange={e => setQuickAddName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') submitQuickAdd()
                        if (e.key === 'Escape') setQuickAddCol(null)
                      }}
                      placeholder="Feature name..."
                      style={{
                        width: '100%',
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        fontSize: 12,
                        color: '#fff',
                        marginBottom: 8,
                        fontFamily: 'inherit',
                        boxSizing: 'border-box',
                      }}
                    />
                    {phases.length > 1 && (
                      <select
                        value={quickAddPhaseId}
                        onChange={e => setQuickAddPhaseId(e.target.value)}
                        style={{
                          width: '100%',
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: 6,
                          padding: '5px 8px',
                          fontSize: 11,
                          color: '#fff',
                          outline: 'none',
                          marginBottom: 8,
                          boxSizing: 'border-box',
                        }}
                      >
                        {phases.map(p => (
                          <option
                            key={p.id}
                            value={p.id}
                            style={{ background: '#0a0a18' }}
                          >
                            {p.name}
                          </option>
                        ))}
                      </select>
                    )}
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={submitQuickAdd}
                        disabled={!quickAddName.trim() || quickAddSaving}
                        style={{
                          flex: 1,
                          padding: '6px',
                          background: accent,
                          color: '#000',
                          border: 'none',
                          borderRadius: 7,
                          fontSize: 10,
                          fontWeight: 800,
                          cursor: quickAddName.trim() ? 'pointer' : 'not-allowed',
                          opacity: quickAddName.trim() ? 1 : 0.5,
                        }}
                      >
                        {quickAddSaving ? '...' : 'Add'}
                      </button>
                      <button
                        onClick={() => setQuickAddCol(null)}
                        style={{
                          padding: '6px 10px',
                          background: 'rgba(255,255,255,0.04)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: 7,
                          color: 'rgba(255,255,255,0.4)',
                          fontSize: 10,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Esc
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Inline add trigger at bottom of column */
                  <button
                    onClick={() => openQuickAdd(col.key)}
                    style={{
                      width: '100%',
                      padding: '8px',
                      background: 'transparent',
                      border: '1px dashed rgba(255,255,255,0.08)',
                      borderRadius: 10,
                      color: 'rgba(255,255,255,0.2)',
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 5,
                      transition: 'all 0.15s',
                      marginTop: 2,
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = `${col.color}40`
                      e.currentTarget.style.color = col.color
                      e.currentTarget.style.background = `${col.color}06`
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
                      e.currentTarget.style.color = 'rgba(255,255,255,0.2)'
                      e.currentTarget.style.background = 'transparent'
                    }}
                  >
                    <Plus size={11} /> Add card
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Detail panel ─────────────────────────────────── */}
      {panelType && panelId && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 30, pointerEvents: 'none' }}>
          <div style={{ pointerEvents: 'all', position: 'absolute', inset: 0 }}>
            <DetailPanel
              type={panelType}
              itemId={panelId}
              projectId={projectId}
              phases={phases}
              features={features}
              onClose={() => {
                setPanelType(null)
                setPanelId(null)
              }}
              onUpdatePhase={updatePhase}
              onDeletePhase={deletePhase}
              onUpdateFeature={updateFeature}
              onDeleteFeature={deleteFeature}
            />
          </div>
        </div>
      )}

      {/* ── Add feature modal ────────────────────────────── */}
      {showAddFeature && (
        <AddFeatureModal
          phases={phases}
          defaultPhaseId={addFeatureDefaultPhase}
          onClose={() => setShowAddFeature(false)}
          onConfirm={handleCreateFeature}
          saving={modalSaving}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
//  FeatureCard
// ─────────────────────────────────────────────────────────

interface FeatureCardProps {
  feature: Feature
  phases: Array<{ id: string; name: string }>
  colStatus: StatusKey
  colColor: string
  isDragging: boolean
  isDropTarget: boolean
  onDragStart: (e: React.DragEvent, id: string) => void
  onDragEnd: () => void
  onDragOver: (e: React.DragEvent, col: StatusKey, id: string) => void
  onDrop: (e: React.DragEvent) => void
  onClick: () => void
}

function FeatureCard({
  feature,
  phases,
  colStatus,
  colColor,
  isDragging,
  isDropTarget,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onClick,
}: FeatureCardProps) {
  const parentPhase = phases.find(p => p.id === feature.phase_id)

  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, feature.id)}
      onDragEnd={onDragEnd}
      onDragOver={e => onDragOver(e, colStatus, feature.id)}
      onDrop={onDrop}
      onClick={onClick}
      style={{
        padding: '12px 13px',
        borderRadius: 10,
        background: isDragging
          ? 'rgba(255,255,255,0.02)'
          : 'rgba(255,255,255,0.04)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        border: isDropTarget
          ? `1px solid ${colColor}50`
          : isDragging
          ? '1px solid rgba(255,255,255,0.04)'
          : '1px solid rgba(255,255,255,0.08)',
        cursor: 'grab',
        opacity: isDragging ? 0.4 : 1,
        transform: isDropTarget && !isDragging
          ? 'translateY(-2px)'
          : 'translateY(0)',
        boxShadow: isDropTarget && !isDragging
          ? `0 4px 16px ${colColor}20`
          : isDragging
          ? 'none'
          : '0 2px 8px rgba(0,0,0,0.2)',
        transition: 'all 0.12s ease',
        userSelect: 'none',
      }}
    >
      {/* Feature name */}
      <div style={{
        fontSize: 12, fontWeight: 600,
        color: '#fff', lineHeight: 1.4,
        marginBottom: 8,
        wordBreak: 'break-word',
      }}>
        {feature.name}
      </div>

      {/* Badges row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        flexWrap: 'wrap',
        marginBottom: parentPhase ? 8 : 0,
      }}>
        <FeatureTypeBadge type={feature.type} />
        <PriorityBadge priority={feature.priority} />
      </div>

      {/* Phase label */}
      {parentPhase && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          fontSize: 10,
          color: 'rgba(255,255,255,0.3)',
          fontWeight: 500,
          borderTop: '1px solid rgba(255,255,255,0.05)',
          paddingTop: 7,
          marginTop: 2,
        }}>
          <span style={{
            width: 5, height: 5,
            borderRadius: '50%',
            background: 'rgba(59,130,246,0.6)',
            flexShrink: 0,
          }} />
          {parentPhase.name}
        </div>
      )}
    </div>
  )
}
