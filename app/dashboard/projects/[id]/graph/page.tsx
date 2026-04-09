'use client'

import {
  useState, useCallback, useEffect, useRef, useMemo, useLayoutEffect,
} from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTheme } from '@/hooks/useTheme'
import { useProjectData } from './useProjectData'
import { DetailPanel } from './DetailPanel'
import { AddPhaseModal } from './AddPhaseModal'
import { AddFeatureModal } from './AddFeatureModal'
import { StatusBadge } from './StatusBadge'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { STATUS_CONFIG, FEATURE_TYPE_CONFIG } from './types'
import type { Phase, Feature, StatusKey } from './types'
import {
  Layers, Box,
  LayoutGrid, Maximize2, RefreshCw,
  GitBranch, Network,
} from 'lucide-react'

// ─────────────────────────────────────────────────────────
//  Constants & helpers
// ─────────────────────────────────────────────────────────

const NODE_W   = 240   // feature card width
const NODE_H   = 96    // feature card height — extra room for status pill
const PHASE_HEADER_H = 44   // phase lane header
const COL_GAP  = 32    // gap between phase lanes
const ROW_GAP  = 20    // gap between feature cards in a lane
const LANE_PAD = 14    // padding inside lane (top/bottom/sides)
const PROJECT_NODE_H = 60

function hexToRgba(hex: string, a: number) {
  if (!hex || hex.length < 7) return `rgba(245,158,11,${a})`
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

interface Annotation {
  id:        string
  x:         number
  y:         number
  width:     number
  height:    number
  text:      string
  kind:      'note' | 'bug' | 'todo' | 'comment'
  color?:    string
}

const ANNOTATION_KINDS: {
  key: Annotation['kind']
  label: string
  color: string
  bg: string
  border: string
  emoji: string
}[] = [
  { key: 'note',    label: 'Note',    color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',   border: 'rgba(245,158,11,0.3)',   emoji: '📝' },
  { key: 'bug',     label: 'Bug',     color: '#f87171', bg: 'rgba(248,113,113,0.08)',  border: 'rgba(248,113,113,0.3)',  emoji: '🐛' },
  { key: 'todo',    label: 'TODO',    color: '#60a5fa', bg: 'rgba(96,165,250,0.08)',   border: 'rgba(96,165,250,0.3)',   emoji: '✅' },
  { key: 'comment', label: 'Comment', color: '#a78bfa', bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.3)', emoji: '💬' },
]

function statusDot(status: string): string {
  const map: Record<string, string> = {
    planned:     'rgba(255,255,255,0.3)',
    todo:        '#94a3b8',
    in_progress: '#60a5fa',
    review:      '#a78bfa',
    blocked:     '#f87171',
    done:        '#34d399',
    complete:    '#34d399',
  }
  return map[status] ?? 'rgba(255,255,255,0.2)'
}

// ─────────────────────────────────────────────────────────
//  Layout calculator
//  Returns absolute positions for the swimlane layout:
//    - One vertical "lane" per phase
//    - Feature cards stacked vertically inside each lane
//    - Project node centered above all lanes
// ─────────────────────────────────────────────────────────

interface LayoutNode {
  id:     string
  x:      number
  y:      number
  width:  number
  height: number
  type:   'project' | 'phase' | 'feature'
  phaseId?: string
}

function buildLayout(phases: Phase[], features: Feature[]): {
  nodes:       LayoutNode[]
  totalW:      number
  totalH:      number
  phaseX:      Record<string, number>
  phaseH:      Record<string, number>
} {
  const nodes: LayoutNode[] = []
  const phaseX: Record<string, number> = {}
  const phaseH: Record<string, number> = {}

  let curX = LANE_PAD

  for (const phase of phases) {
    const pf = features.filter(f => f.phase_id === phase.id)
    const laneH =
      PHASE_HEADER_H + LANE_PAD +
      pf.length * NODE_H +
      Math.max(0, pf.length - 1) * ROW_GAP +
      LANE_PAD

    phaseX[phase.id] = curX
    phaseH[phase.id] = Math.max(laneH, PHASE_HEADER_H + LANE_PAD * 2 + 60)

    // Phase container node (just used for sizing — rendered as swimlane bg)
    nodes.push({
      id:     `phase-${phase.id}`,
      x:      curX,
      y:      PROJECT_NODE_H + 60,
      width:  NODE_W + LANE_PAD * 2,
      height: phaseH[phase.id],
      type:   'phase',
      phaseId: phase.id,
    })

    // Feature nodes inside the lane
    pf.forEach((feat, fi) => {
      nodes.push({
        id:      `feature-${feat.id}`,
        x:       curX + LANE_PAD,
        y:       PROJECT_NODE_H + 60 + PHASE_HEADER_H + LANE_PAD + fi * (NODE_H + ROW_GAP),
        width:   NODE_W,
        height:  NODE_H,
        type:    'feature',
        phaseId: phase.id,
      })
    })

    curX += NODE_W + LANE_PAD * 2 + COL_GAP
  }

  const totalW = Math.max(curX - COL_GAP + LANE_PAD, 800)
  const maxLaneH = Math.max(...Object.values(phaseH), 200)
  const totalH = PROJECT_NODE_H + 60 + maxLaneH + 80

  // Project root node — centered
  nodes.unshift({
    id:     'project',
    x:      totalW / 2 - 140,
    y:      LANE_PAD,
    width:  280,
    height: PROJECT_NODE_H,
    type:   'project',
  })

  return { nodes, totalW, totalH, phaseX, phaseH }
}

// ─────────────────────────────────────────────────────────
//  SVG edge path builder
//  Smooth cubic bezier from project → phase top,
//  and from phase → feature (implicit via swimlane, no edges needed)
// ─────────────────────────────────────────────────────────

function buildEdges(
  layout: LayoutNode[],
  phases: Phase[],
): { d: string; id: string; color: string }[] {
  const edges: { d: string; id: string; color: string }[] = []
  const projectNode = layout.find(n => n.type === 'project')
  if (!projectNode) return edges

  const srcX = projectNode.x + projectNode.width / 2
  const srcY = projectNode.y + projectNode.height

  for (const phase of phases) {
    const phaseNode = layout.find(n => n.id === `phase-${phase.id}`)
    if (!phaseNode) continue
    const tgtX = phaseNode.x + phaseNode.width / 2
    const tgtY = phaseNode.y

    const midY = (srcY + tgtY) / 2
    const d = `M ${srcX} ${srcY} C ${srcX} ${midY}, ${tgtX} ${midY}, ${tgtX} ${tgtY}`
    const cfg = STATUS_CONFIG[phase.status] ?? STATUS_CONFIG['planned']
    edges.push({ d, id: `edge-proj-${phase.id}`, color: cfg.color })
  }

  return edges
}

// ─────────────────────────────────────────────────────────
//  Mini-map component
// ─────────────────────────────────────────────────────────

function MiniMap({
  totalW, totalH, viewX, viewY, viewW, viewH, accent,
  phases, features, layout,
}: {
  totalW: number; totalH: number
  viewX: number; viewY: number; viewW: number; viewH: number
  accent: string
  phases: Phase[]; features: Feature[]
  layout: LayoutNode[]
}) {
  const W = 160; const H = 100
  const scaleX = W / totalW; const scaleY = H / totalH
  const scale = Math.min(scaleX, scaleY)

  return (
    <div style={{
      background: 'rgba(8,8,20,0.85)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12,
      overflow: 'hidden',
      position: 'relative',
    }}>
      <svg
        width={W} height={H}
        style={{ display: 'block' }}
      >
        <rect width="100%" height="100%" fill="rgba(0,0,0,0.6)" />
        {/* Phase lanes */}
        {layout.filter(n => n.type === 'phase').map(n => {
          const phase = phases.find(p => `phase-${p.id}` === n.id)
          const cfg = phase ? (STATUS_CONFIG[phase.status] ?? STATUS_CONFIG['planned']) : STATUS_CONFIG['planned']
          return (
            <rect
              key={n.id}
              x={n.x * scale} y={n.y * scale}
              width={n.width * scale} height={n.height * scale}
              fill={cfg.bg} stroke={cfg.border} strokeWidth={0.5}
              rx={2}
            />
          )
        })}
        {/* Feature dots */}
        {layout.filter(n => n.type === 'feature').map(n => {
          const feat = features.find(f => `feature-${f.id}` === n.id)
          return (
            <rect
              key={n.id}
              x={n.x * scale} y={n.y * scale}
              width={n.width * scale} height={n.height * scale}
              fill={feat ? hexToRgba(statusDot(feat.status), 0.4) : 'rgba(255,255,255,0.1)'}
              rx={1}
            />
          )
        })}
        {/* Viewport rect */}
        <rect
          x={viewX * scale} y={viewY * scale}
          width={viewW * scale} height={viewH * scale}
          fill="none" stroke={accent} strokeWidth={1.5}
          rx={2}
          style={{ opacity: 0.9 }}
        />
      </svg>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
//  Feature card component
// ─────────────────────────────────────────────────────────

function FeatureCard({
  feature, accent, selected, onSelect, onStatusChange,
}: {
  feature: Feature
  accent:  string
  selected: boolean
  onSelect: () => void
  onStatusChange: (status: StatusKey) => void
}) {
  const [showStatusMenu, setShowStatusMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const dotColor = statusDot(feature.status)
  const cfg = STATUS_CONFIG[feature.status] ?? STATUS_CONFIG['planned']
  const typeCfg = FEATURE_TYPE_CONFIG[feature.type] ?? { label: feature.type, color: 'rgba(255,255,255,0.3)' }

  useEffect(() => {
    if (!showStatusMenu) return
    const h = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setShowStatusMenu(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [showStatusMenu])

  return (
    <div
      onClick={onSelect}
      style={{
        width: NODE_W, height: NODE_H,
        background: selected
          ? hexToRgba(accent, 0.1)
          : 'rgba(255,255,255,0.04)',
        border: `1px solid ${selected ? hexToRgba(accent, 0.5) : 'rgba(255,255,255,0.08)'}`,
        borderRadius: 12,
        padding: '10px 12px',
        cursor: 'pointer',
        position: 'relative',
        boxSizing: 'border-box',
        transition: 'border-color 0.15s, background 0.15s, box-shadow 0.15s',
        boxShadow: selected ? `0 0 0 1px ${hexToRgba(accent, 0.2)}, 0 4px 16px rgba(0,0,0,0.3)` : '0 2px 8px rgba(0,0,0,0.2)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
      onMouseEnter={e => {
        if (!selected) {
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)'
          e.currentTarget.style.background = 'rgba(255,255,255,0.07)'
        }
      }}
      onMouseLeave={e => {
        if (!selected) {
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
          e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
        }
      }}
    >
      {/* Type label + status dot */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{
          fontSize: 8, fontWeight: 800, letterSpacing: '0.1em',
          textTransform: 'uppercase', color: typeCfg.color,
        }}>
          {typeCfg.label}
        </span>

        {/* Status dot — click to cycle */}
        <div
          ref={menuRef}
          onClick={e => { e.stopPropagation(); setShowStatusMenu(v => !v) }}
          style={{ position: 'relative', cursor: 'pointer' }}
        >
          <div style={{
            width: 10, height: 10, borderRadius: '50%',
            background: dotColor,
            boxShadow: `0 0 6px ${dotColor}`,
            transition: 'all 0.15s',
          }} title={cfg.label} />

          {/* Status dropdown */}
          {showStatusMenu && (
            <div style={{
              position: 'absolute', top: 16, right: 0,
              background: 'rgba(8,8,20,0.97)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 10, padding: '6px',
              zIndex: 999, minWidth: 130,
              boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
              backdropFilter: 'blur(20px)',
            }}>
              {Object.entries(STATUS_CONFIG).filter(([k]) => k !== 'complete').map(([key, s]) => (
                <div
                  key={key}
                  onClick={e => {
                    e.stopPropagation()
                    onStatusChange(key as StatusKey)
                    setShowStatusMenu(false)
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '7px 10px', borderRadius: 7, cursor: 'pointer',
                    background: feature.status === key ? hexToRgba(accent, 0.1) : 'transparent',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                  onMouseLeave={e => e.currentTarget.style.background = feature.status === key ? hexToRgba(accent, 0.1) : 'transparent'}
                >
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }}/>
                  <span style={{ fontSize: 11, color: feature.status === key ? '#fff' : 'rgba(255,255,255,0.6)', fontWeight: feature.status === key ? 600 : 400 }}>
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Feature name */}
      <div style={{
        fontSize: 11, fontWeight: 600, color: '#fff',
        lineHeight: 1.4,
        overflow: 'hidden',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical' as const,
        marginBottom: 26,   // leaves room for the absolute status pill
        wordBreak: 'break-word',
      }}>
        {feature.name}
      </div>

      {/* Status pill at bottom */}
      <div style={{ position: 'absolute', bottom: 7, left: 10, right: 10 }}>
        <StatusBadge status={feature.status} size="sm" pulse />
      </div>
    </div>
  )
}

function AnnotationCard({
  ann,
  onUpdate,
  onDelete,
  onDragEnd,
}: {
  ann:       Annotation
  onUpdate:  (id: string, text: string) => void
  onDelete:  (id: string) => void
  onDragEnd: (id: string, dx: number, dy: number) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState(ann.text)
  const textRef = useRef<HTMLTextAreaElement>(null)
  const dragStart = useRef<{ mx: number; my: number } | null>(null)
  const kindCfg = ANNOTATION_KINDS.find(k => k.key === ann.kind) ?? ANNOTATION_KINDS[0]

  useEffect(() => {
    if (editing) textRef.current?.focus()
  }, [editing])

  const handleSave = () => {
    setEditing(false)
    onUpdate(ann.id, draft)
  }

  return (
    <div
      data-interactive
      style={{
        position: 'absolute',
        left: ann.x, top: ann.y,
        width: ann.width, minHeight: ann.height,
        background: kindCfg.bg,
        border: `1px solid ${kindCfg.border}`,
        borderRadius: 12,
        boxSizing: 'border-box',
        zIndex: 4,
        cursor: editing ? 'text' : 'grab',
        boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
        backdropFilter: 'blur(8px)',
      }}
      onMouseDown={e => {
        if (editing) return
        e.stopPropagation()
        dragStart.current = { mx: e.clientX, my: e.clientY }
        const onUp = (ev: MouseEvent) => {
          if (dragStart.current) {
            const dx = ev.clientX - dragStart.current.mx
            const dy = ev.clientY - dragStart.current.my
            onDragEnd(ann.id, dx, dy)
            dragStart.current = null
          }
          window.removeEventListener('mouseup', onUp)
        }
        window.addEventListener('mouseup', onUp)
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '8px 10px 6px',
        borderBottom: `1px solid ${kindCfg.border}`,
      }}>
        <span style={{ fontSize: 11 }}>{kindCfg.emoji}</span>
        <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: kindCfg.color }}>
          {kindCfg.label}
        </span>
        <div style={{ flex: 1 }}/>
        <button
          onClick={() => setEditing(v => !v)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', fontSize: 12, padding: 2 }}
          title="Edit"
        >✏️</button>
        <button
          onClick={e => { e.stopPropagation(); onDelete(ann.id) }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.25)', fontSize: 12, padding: 2 }}
          title="Delete"
        >✕</button>
      </div>

      {/* Body */}
      <div style={{ padding: '8px 10px 10px' }}>
        {editing ? (
          <textarea
            ref={textRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={handleSave}
            onKeyDown={e => { if (e.key === 'Escape') { setEditing(false); setDraft(ann.text) } }}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: 'rgba(255,255,255,0.05)',
              border: `1px solid ${kindCfg.border}`,
              borderRadius: 6, padding: '6px 8px',
              fontSize: 12, color: '#fff', lineHeight: 1.55,
              resize: 'none', minHeight: 60, outline: 'none',
              fontFamily: 'inherit',
            }}
          />
        ) : (
          <div
            style={{
              fontSize: 12, color: 'rgba(255,255,255,0.75)',
              lineHeight: 1.55, whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              cursor: 'text', minHeight: 36,
            }}
            onDoubleClick={() => setEditing(true)}
          >
            {ann.text || <span style={{ color: 'rgba(255,255,255,0.25)', fontStyle: 'italic' }}>Double-click to add text…</span>}
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
//  Phase swimlane header
// ─────────────────────────────────────────────────────────

function PhaseLaneHeader({
  phase, features, accent, selected, onSelect,
}: {
  phase:   Phase
  features: Feature[]
  accent:  string
  selected: boolean
  onSelect: () => void
}) {
  const pf   = features.filter(f => f.phase_id === phase.id)
  const done = pf.filter(f => f.status === 'done' || f.status === 'complete').length
  const pct  = pf.length > 0 ? Math.round((done / pf.length) * 100) : 0
  const cfg  = STATUS_CONFIG[phase.status] ?? STATUS_CONFIG['planned']

  return (
    <div
      onClick={onSelect}
      style={{
        height: PHASE_HEADER_H,
        display: 'flex', alignItems: 'center',
        padding: '0 14px',
        borderBottom: `1px solid ${hexToRgba(cfg.color, 0.2)}`,
        cursor: 'pointer',
        borderRadius: '12px 12px 0 0',
        background: selected ? hexToRgba(accent, 0.08) : 'transparent',
        transition: 'background 0.15s',
        gap: 10,
      }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'transparent' }}
    >
      {/* Phase order */}
      <div style={{
        width: 22, height: 22, borderRadius: 6, flexShrink: 0,
        background: hexToRgba(cfg.color, 0.15),
        border: `1px solid ${hexToRgba(cfg.color, 0.35)}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 9, fontWeight: 900, color: cfg.color,
      }}>
        {String(phase.order_index + 1).padStart(2, '0')}
      </div>

      {/* Phase name */}
      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
        <div style={{
          fontSize: 11, fontWeight: 700, color: '#fff',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {phase.name}
        </div>
      </div>

      {/* Progress + count */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <div style={{
          fontSize: 10, fontWeight: 700,
          color: pct === 100 ? '#34d399' : 'rgba(255,255,255,0.4)',
        }}>
          {pct}%
        </div>
        <div style={{
          width: 40, height: 3, borderRadius: 99,
          background: 'rgba(255,255,255,0.08)', overflow: 'hidden',
          flexShrink: 0,
        }}>
          <div style={{
            height: '100%', borderRadius: 99,
            width: `${pct}%`,
            background: pct === 100 ? '#34d399' : cfg.color,
            transition: 'width 0.4s ease',
          }}/>
        </div>
        <div style={{
          fontSize: 9, color: 'rgba(255,255,255,0.3)',
          letterSpacing: '0.04em',
        }}>
          {done}/{pf.length}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
//  Main graph page — custom canvas
// ─────────────────────────────────────────────────────────

function GraphCanvas() {
  const params    = useParams()
  const router    = useRouter()
  const { accent } = useTheme()
  const ac        = accent || '#f59e0b'
  const projectId = params.id as string

  const {
    project, phases, features, loading,
    refetch,
    createPhase, updatePhase, deletePhase,
    createFeature, updateFeature, deleteFeature,
    setFeatureStatus,
  } = useProjectData(projectId)

  // ── Pan / zoom state ──────────────────────────────────
  const canvasRef    = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [pan,  setPan]  = useState({ x: 40, y: 40 })
  const [zoom, setZoom] = useState(1)
  const isMobile = useIsMobile()
  const isPanning = useRef(false)
  const lastMouse = useRef({ x: 0, y: 0 })

  // ── Touch state ───────────────────────────────────────
  const touchStartDist = useRef<number | null>(null)
  const touchMidPoint  = useRef<{ x: number, y: number } | null>(null)
  const touchStartPan  = useRef<{ x: number, y: number } | null>(null)
  const touchStartZoom = useRef<number>(1)

  // ── Selection ─────────────────────────────────────────
  const [selectedId,   setSelectedId]   = useState<string | null>(null)
  const [selectedType, setSelectedType] = useState<'phase' | 'feature' | null>(null)

  // ── Modals ────────────────────────────────────────────
  const [showAddPhase,   setShowAddPhase]   = useState(false)
  const [showAddFeature, setShowAddFeature] = useState(false)
  const [modalSaving,    setModalSaving]    = useState(false)
  const [locked, setLocked] = useState(false)

  const ANNOT_KEY = `reminisce_annotations_${projectId}`
  const [annotations, setAnnotations] = useState<Annotation[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const saved = localStorage.getItem(ANNOT_KEY)
      return saved ? JSON.parse(saved) : []
    } catch { return [] }
  })
  const [showAnnotationMenu, setShowAnnotationMenu] = useState(false)
  const [annotationMenuPos, setAnnotationMenuPos] = useState({ x: 0, y: 0 })
  const [dropTargetPhaseId, setDropTargetPhaseId] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem(ANNOT_KEY, JSON.stringify(annotations))
  }, [annotations, ANNOT_KEY])

  // Committed positions — only updated on mouseup (no per-frame re-renders)
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }>>({})
  // Live drag positions — stored in a ref, mutated directly via DOM during active drag
  const livePositions = useRef<Record<string, { x: number; y: number }>>({})
  const draggingNode  = useRef<{ id: string; startX: number; startY: number; origX: number; origY: number; el: HTMLElement | null } | null>(null)

  // ── Layout ────────────────────────────────────────────
  const layout = useMemo(
    () => buildLayout(phases, features),
    [phases, features]
  )

  const edges = useMemo(
    () => buildEdges(layout.nodes, phases),
    [layout, phases]
  )

  // ── Fit view on load ──────────────────────────────────
  useLayoutEffect(() => {
    if (!containerRef.current || loading || !phases.length) return
    const cW = containerRef.current.clientWidth
    const cH = containerRef.current.clientHeight
    const scaleX = (cW - 80) / layout.totalW
    const scaleY = (cH - 80) / layout.totalH
    const newZoom = Math.min(scaleX, scaleY, 1)
    const newPanX = (cW - layout.totalW * newZoom) / 2
    const newPanY = 40
    setZoom(newZoom)
    setPan({ x: newPanX, y: newPanY })
  }, [loading, phases.length, layout.totalW, layout.totalH])

  // ── Pan handlers ──────────────────────────────────────
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (locked) return
    if ((e.target as HTMLElement).closest('[data-interactive]')) return
    isPanning.current = true
    lastMouse.current = { x: e.clientX, y: e.clientY }
    document.body.style.cursor = 'grabbing'
  }, [locked])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current) return
    const dx = e.clientX - lastMouse.current.x
    const dy = e.clientY - lastMouse.current.y
    lastMouse.current = { x: e.clientX, y: e.clientY }
    setPan(p => ({ x: p.x + dx, y: p.y + dy }))
  }, [])

  const onMouseUp = useCallback(() => {
    isPanning.current = false
    document.body.style.cursor = ''
  }, [])

  // ── Zoom via wheel ────────────────────────────────────
  const onWheel = useCallback((e: React.WheelEvent) => {
    if (locked) return
    if ((e.target as HTMLElement).closest('[data-interactive]')) return
    e.preventDefault()
    const delta    = -e.deltaY * (isMobile ? 0.002 : 0.001) // adjusted for touch pads
    const newZoom  = Math.max(0.1, Math.min(2.5, zoom + delta * zoom))
    const rect     = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const mouseX   = e.clientX - rect.left
    const mouseY   = e.clientY - rect.top
    // Zoom toward cursor
    const scaleChg = newZoom / zoom
    setPan(p => ({
      x: mouseX - (mouseX - p.x) * scaleChg,
      y: mouseY - (mouseY - p.y) * scaleChg,
    }))
    setZoom(newZoom)
  }, [zoom, locked, isMobile])

  // ── Touch handlers ───────────────────────────────────
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (locked) return
    if ((e.target as HTMLElement).closest('[data-interactive]')) return

    if (e.touches.length === 1) {
      // Single finger pan
      isPanning.current = true
      lastMouse.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    } else if (e.touches.length === 2) {
      // Pinch to zoom
      isPanning.current = false
      const t1 = e.touches[0]
      const t2 = e.touches[1]
      const dist = Math.sqrt(Math.pow(t2.clientX - t1.clientX, 2) + Math.pow(t2.clientY - t1.clientY, 2))
      touchStartDist.current = dist
      touchStartZoom.current = zoom
      touchStartPan.current = { x: pan.x, y: pan.y }
      
      const rect = containerRef.current?.getBoundingClientRect()
      if (rect) {
        touchMidPoint.current = {
          x: (t1.clientX + t2.clientX) / 2 - rect.left,
          y: (t1.clientY + t2.clientY) / 2 - rect.top,
        }
      }
    }
  }, [locked, zoom, pan.x, pan.y])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (locked) return
    if (isPanning.current && e.touches.length === 1) {
      // Panning
      const dx = e.touches[0].clientX - lastMouse.current.x
      const dy = e.touches[0].clientY - lastMouse.current.y
      lastMouse.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      setPan(p => ({ x: p.x + dx, y: p.y + dy }))
    } else if (e.touches.length === 2 && touchStartDist.current && touchMidPoint.current && touchStartPan.current) {
      // Pinching
      const t1 = e.touches[0]
      const t2 = e.touches[1]
      const dist = Math.sqrt(Math.pow(t2.clientX - t1.clientX, 2) + Math.pow(t2.clientY - t1.clientY, 2))
      
      const scale = dist / touchStartDist.current
      const newZoom = Math.max(0.1, Math.min(2.5, touchStartZoom.current * scale))
      
      const midX = touchMidPoint.current.x
      const midY = touchMidPoint.current.y
      
      const scaleChg = newZoom / touchStartZoom.current
      
      setPan({
        x: midX - (midX - touchStartPan.current.x) * scaleChg,
        y: midY - (midY - touchStartPan.current.y) * scaleChg,
      })
      setZoom(newZoom)
    }
  }, [locked, zoom])

  const onTouchEnd = useCallback(() => {
    isPanning.current = false
    touchStartDist.current = null
    touchMidPoint.current = null
    touchStartPan.current = null
  }, [])

  // ── Fit view ──────────────────────────────────────────
  const fitView = useCallback(() => {
    if (!containerRef.current) return
    const cW = containerRef.current.clientWidth
    const cH = containerRef.current.clientHeight
    const scaleX = (cW - 80) / layout.totalW
    const scaleY = (cH - 80) / layout.totalH
    const newZoom = Math.min(scaleX, scaleY, 1)
    const newPanX = (cW - layout.totalW * newZoom) / 2
    setZoom(newZoom)
    setPan({ x: newPanX, y: 40 })
  }, [layout.totalW, layout.totalH])

  const handleNodeDragStart = useCallback((
    e: React.MouseEvent,
    nodeId: string,
    currentX: number,
    currentY: number,
  ) => {
    e.stopPropagation()
    const el = (e.currentTarget as HTMLElement).closest<HTMLElement>('[data-node-id]')
    draggingNode.current = {
      id: nodeId,
      startX: e.clientX,
      startY: e.clientY,
      origX: currentX,
      origY: currentY,
      el,
    }
    document.body.style.cursor = 'grabbing'

    const onMove = (mv: MouseEvent) => {
      if (!draggingNode.current) return
      const dx = (mv.clientX - draggingNode.current.startX) / zoom
      const dy = (mv.clientY - draggingNode.current.startY) / zoom
      const newX = draggingNode.current.origX + dx
      const newY = draggingNode.current.origY + dy
      // Mutate DOM directly — zero React re-renders during drag
      if (draggingNode.current.el) {
        draggingNode.current.el.style.left = `${newX}px`
        draggingNode.current.el.style.top  = `${newY}px`
      }
      // Keep live ref in sync for reading on mouseup
      livePositions.current[draggingNode.current.id] = { x: newX, y: newY }
    }

    const onUp = () => {
      if (draggingNode.current) {
        const { id } = draggingNode.current
        // Only now commit to React state — single re-render on drop
        if (livePositions.current[id]) {
          setNodePositions(prev => ({
            ...prev,
            [id]: livePositions.current[id],
          }))
        }
        draggingNode.current = null
      }
      document.body.style.cursor = ''
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [zoom])

  // ── Keyboard: Esc deselects ───────────────────────────
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelectedId(null) }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  // ── Mutations ─────────────────────────────────────────
  const handleCreatePhase = useCallback(async (name: string, desc: string) => {
    setModalSaving(true)
    await createPhase({ name, description: desc })
    setModalSaving(false)
    setShowAddPhase(false)
  }, [createPhase])

  const handleCreateFeature = useCallback(async (input: {
    name: string; description: string; type: string; phaseId: string
  }) => {
    setModalSaving(true)
    await createFeature({
      name:        input.name,
      description: input.description,
      type:        input.type as 'frontend',
      phaseId:     input.phaseId,
    })
    setModalSaving(false)
    setShowAddFeature(false)
  }, [createFeature])

  // ── Loading / empty ───────────────────────────────────
  if (loading) return (
    <div style={{
      height: 'calc(100vh - 68px)',
      background: '#07070f',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 320 }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{
            height: i === 1 ? 48 : 120,
            background: 'rgba(255,255,255,0.04)',
            borderRadius: 12,
            animation: 'skelPulse 1.5s ease infinite',
            animationDelay: `${i * 0.1}s`,
          }}/>
        ))}
      </div>
      <style>{`@keyframes skelPulse{0%,100%{opacity:.4}50%{opacity:.8}}`}</style>
    </div>
  )

  if (!phases.length) return (
    <div style={{
      height: 'calc(100vh - 68px)',
      background: 'linear-gradient(160deg, rgba(var(--accent-rgb),0.04) 0%, transparent 50%), #07070f',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 20,
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: 18,
        background: hexToRgba(ac, 0.06),
        border: `1px solid ${hexToRgba(ac, 0.15)}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Network size={28} color={hexToRgba(ac, 0.5)}/>
      </div>
      <div style={{ textAlign: 'center' }}>
        <h3 style={{ fontSize: 20, fontWeight: 800, color: '#fff', margin: '0 0 8px' }}>
          No phases yet
        </h3>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', maxWidth: 320, lineHeight: 1.7, margin: '0 0 24px' }}>
          Run the Wizard to auto-generate your project architecture, or add phases manually.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button
            onClick={() => router.push(`/dashboard/projects/${projectId}/wizard`)}
            style={{ padding: '10px 22px', background: ac, color: '#000', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
          >
            Open Wizard →
          </button>
          <button
            onClick={() => setShowAddPhase(true)}
            style={{ padding: '10px 22px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
          >
            + Add Phase
          </button>
        </div>
      </div>
      {showAddPhase && (
        <AddPhaseModal
          onClose={() => setShowAddPhase(false)}
          onConfirm={handleCreatePhase}
          saving={modalSaving}
        />
      )}
    </div>
  )

  // ── Viewport tracking for minimap ─────────────────────
  const viewW = containerRef.current ? containerRef.current.clientWidth / zoom : 800
  const viewH = containerRef.current ? containerRef.current.clientHeight / zoom : 600
  const viewX = -pan.x / zoom
  const viewY = -pan.y / zoom

  // ── Progress summary ──────────────────────────────────
  const totalFeatures = features.length
  const doneFeatures  = features.filter(f => f.status === 'done' || f.status === 'complete').length
  const inProg        = features.filter(f => f.status === 'in_progress').length
  const blocked       = features.filter(f => f.status === 'blocked').length
  const overallPct    = totalFeatures > 0 ? Math.round((doneFeatures / totalFeatures) * 100) : 0

  // ── Render ────────────────────────────────────────────
  return (
    <div style={{
      height: 'calc(100vh - 68px)',
      display: 'flex', flexDirection: 'column',
      background: '#05050f',
      overflow: 'hidden', position: 'relative',
    }}>
      <title>{`Reminisce — Graph — ${project?.name}`}</title>

      <style>{`
        @keyframes skelPulse{0%,100%{opacity:.4}50%{opacity:.8}}
        @keyframes dotPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.5;transform:scale(0.7)}}
      `}</style>

      {/* ── Top bar ──────────────────────────────────── */}
      <div style={{
        height: 52, flexShrink: 0,
        display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12,
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        background: 'rgba(8,8,20,0.8)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        zIndex: 10, position: 'relative',
      }}>
        {/* Project name */}
        <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.04em', marginRight: 4 }}>
          {project?.name}
        </span>
        <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.1)' }}/>

        {/* Add buttons */}
        <button data-interactive onClick={() => setShowAddPhase(true)} style={{
          background: ac, color: '#000', borderRadius: 999,
          padding: '7px 16px', fontSize: 11, fontWeight: 800,
          border: 'none', cursor: 'pointer',
          boxShadow: `0 0 16px ${hexToRgba(ac, 0.3)}`,
          transition: 'all 0.15s',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <Layers size={11}/> Add Phase
        </button>

        <button data-interactive onClick={() => setShowAddFeature(true)} style={{
          background: ac, color: '#000', borderRadius: 999,
          padding: '7px 16px', fontSize: 11, fontWeight: 800,
          border: 'none', cursor: 'pointer',
          boxShadow: `0 0 16px ${hexToRgba(ac, 0.3)}`,
          transition: 'all 0.15s',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <Box size={11}/> Add Feature
        </button>

        <div style={{ flex: 1 }}/>

        {/* Progress summary */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginRight: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399' }}/>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{doneFeatures} done</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#60a5fa', animation: 'dotPulse 2s infinite' }}/>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{inProg} active</span>
          </div>
          {blocked > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#f87171' }}/>
              <span style={{ fontSize: 10, color: '#f87171' }}>{blocked} blocked</span>
            </div>
          )}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '3px 10px',
            background: overallPct === 100 ? 'rgba(52,211,153,0.1)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${overallPct === 100 ? 'rgba(52,211,153,0.3)' : 'rgba(255,255,255,0.08)'}`,
            borderRadius: 999,
          }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: overallPct === 100 ? '#34d399' : 'rgba(255,255,255,0.6)' }}>
              {overallPct}%
            </span>
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: 6 }}>
          {Object.keys(nodePositions).length > 0 && (
            <button
              data-interactive
              onClick={() => setNodePositions({})}
              title="Reset node positions"
              style={{
                height: 30, padding: '0 12px', borderRadius: 9,
                border: '1px solid rgba(255,255,255,0.09)',
                background: 'rgba(255,255,255,0.05)',
                color: 'rgba(255,255,255,0.55)',
                cursor: 'pointer', fontSize: 11, fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 6,
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#fff' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'rgba(255,255,255,0.55)' }}
            >
              Reset Layout
            </button>
          )}
          <button 
            data-interactive 
            onClick={fitView} 
            title="Fit view" 
            style={{
              width: 32, height: 32, borderRadius: 9, 
              border: '1px solid rgba(255,255,255,0.09)',
              background: 'rgba(255,255,255,0.05)', 
              color: 'rgba(255,255,255,0.55)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#fff' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'rgba(255,255,255,0.55)' }}
          >
            <Maximize2 size={13}/>
          </button>
          <button
            data-interactive
            onClick={() => setLocked(l => !l)}
            title={locked ? 'Unlock canvas' : 'Lock canvas'}
            style={{
              width: 32, height: 32, borderRadius: 9,
              border: `1px solid ${locked ? hexToRgba(ac, 0.3) : 'rgba(255,255,255,0.09)'}`,
              background: locked ? hexToRgba(ac, 0.1) : 'rgba(255,255,255,0.05)',
              color: locked ? ac : 'rgba(255,255,255,0.55)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { if (!locked) { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#fff' } }}
            onMouseLeave={e => { if (!locked) { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'rgba(255,255,255,0.55)' } }}
          >
            {locked ? '🔒' : '🔓'}
          </button>
          <button 
            data-interactive 
            onClick={refetch} 
            title="Refresh" 
            style={{
              width: 32, height: 32, borderRadius: 9, 
              border: '1px solid rgba(255,255,255,0.09)',
              background: 'rgba(255,255,255,0.05)', 
              color: 'rgba(255,255,255,0.55)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#fff' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'rgba(255,255,255,0.55)' }}
          >
            <RefreshCw size={13}/>
          </button>
          <button 
            data-interactive 
            onClick={() => router.push(`/dashboard/projects/${projectId}/board`)} 
            title="Board view" 
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '0 12px', height: 32, borderRadius: 9,
              border: '1px solid rgba(255,255,255,0.09)',
              background: 'rgba(255,255,255,0.05)', 
              color: 'rgba(255,255,255,0.55)',
              cursor: 'pointer', fontSize: 11, fontWeight: 600,
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#fff' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'rgba(255,255,255,0.55)' }}
          >
            <LayoutGrid size={11}/> Board
          </button>
        </div>
      </div>

      {/* ── Canvas area ───────────────────────────────── */}
      <div
        ref={containerRef}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onWheel={onWheel}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{ 
          flex: 1, 
          overflow: 'hidden', 
          position: 'relative', 
          cursor: locked ? 'default' : 'grab',
          touchAction: 'none'
        }}
        onContextMenu={e => {
          e.preventDefault()
          if ((e.target as HTMLElement).closest('[data-interactive]')) return
          setAnnotationMenuPos({ x: e.clientX, y: e.clientY })
          setShowAnnotationMenu(true)
        }}
      >
        {/* Dot grid background */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }}>
          <defs>
            <pattern id="dotgrid" x={pan.x % (24 * zoom)} y={pan.y % (24 * zoom)} width={24 * zoom} height={24 * zoom} patternUnits="userSpaceOnUse">
              <circle cx={1} cy={1} r={0.8} fill="rgba(255,255,255,0.06)"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dotgrid)"/>
        </svg>

        {/* Transformed canvas */}
        <div
          ref={canvasRef}
          style={{
            position: 'absolute',
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
            width: layout.totalW,
            height: layout.totalH,
          }}
        >
          {/* ── SVG edges ─────────────────────────────── */}
          <svg
            style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none', zIndex: 1 }}
            width={layout.totalW} height={layout.totalH}
          >
            <defs>
              {edges.map(edge => (
                <marker key={`m-${edge.id}`} id={`arrow-${edge.id}`}
                  viewBox="0 0 8 8" refX={6} refY={4}
                  markerWidth={6} markerHeight={6}
                  orient="auto-start-reverse">
                  <path d="M0,0 L0,8 L8,4 z" fill={edge.color} opacity={0.5}/>
                </marker>
              ))}
            </defs>
            {edges.map(edge => (
              <path
                key={edge.id}
                d={edge.d}
                fill="none"
                stroke={edge.color}
                strokeWidth={1.5}
                strokeOpacity={0.35}
                strokeDasharray="5 4"
                markerEnd={`url(#arrow-${edge.id})`}
              />
            ))}
          </svg>

          {/* ── Project root node ─────────────────────── */}
          {(() => {
            const n = layout.nodes.find(x => x.type === 'project')
            if (!n) return null
            return (
              <div style={{
                position: 'absolute', left: n.x, top: n.y,
                width: n.width, height: n.height,
                background: 'rgba(8,8,20,0.9)',
                border: `1.5px solid ${hexToRgba(ac, 0.6)}`,
                borderRadius: 14, boxSizing: 'border-box',
                padding: '0 20px',
                display: 'flex', alignItems: 'center', gap: 12,
                boxShadow: `0 0 32px ${hexToRgba(ac, 0.2)}, 0 4px 20px rgba(0,0,0,0.4)`,
                backdropFilter: 'blur(20px)',
                zIndex: 3,
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 9,
                  background: hexToRgba(ac, 0.15),
                  border: `1px solid ${hexToRgba(ac, 0.4)}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <GitBranch size={15} color={ac}/>
                </div>
                <div>
                  <div style={{ fontSize: 7, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: hexToRgba(ac, 0.7), marginBottom: 2 }}>
                    Project
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', letterSpacing: '-0.01em' }}>
                    {project?.name}
                  </div>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{totalFeatures} features</span>
                  <div style={{
                    padding: '2px 10px', borderRadius: 999,
                    background: overallPct === 100 ? 'rgba(52,211,153,0.15)' : hexToRgba(ac, 0.1),
                    border: `1px solid ${overallPct === 100 ? 'rgba(52,211,153,0.35)' : hexToRgba(ac, 0.3)}`,
                    fontSize: 11, fontWeight: 800,
                    color: overallPct === 100 ? '#34d399' : ac,
                  }}>
                    {overallPct}%
                  </div>
                </div>
              </div>
            )
          })()}

          {/* ── Phase swimlanes ───────────────────────── */}
          {phases.map(phase => {
            const lNode = layout.nodes.find(n => n.id === `phase-${phase.id}`)
            if (!lNode) return null

            // Apply any user drag override
            const posOverride = nodePositions[`phase-${phase.id}`]
            const effectiveX = posOverride?.x ?? lNode.x
            const effectiveY = posOverride?.y ?? lNode.y

            const cfg = STATUS_CONFIG[phase.status] ?? STATUS_CONFIG['planned']
            const phaseFeatures = features.filter(f => f.phase_id === phase.id)
            const isSelected = selectedId === phase.id

            return (
              <div
                key={phase.id}
                data-node-id={`phase-${phase.id}`}
                style={{
                  position: 'absolute',
                  left: effectiveX, top: effectiveY,
                  width: lNode.width, height: lNode.height,
                  background: dropTargetPhaseId === phase.id
                    ? hexToRgba(ac, 0.06)
                    : hexToRgba(cfg.color, isSelected ? 0.06 : 0.03),
                  border: dropTargetPhaseId === phase.id
                    ? `2px solid ${hexToRgba(ac, 0.6)}`
                    : `1px solid ${hexToRgba(cfg.color, isSelected ? 0.4 : 0.15)}`,
                  borderRadius: 14,
                  boxSizing: 'border-box',
                  zIndex: 2,
                  transition: 'border-color 0.2s, background 0.2s',
                  boxShadow: isSelected ? `0 0 0 1px ${hexToRgba(cfg.color, 0.2)}, 0 4px 24px rgba(0,0,0,0.3)` : '0 2px 12px rgba(0,0,0,0.2)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                }}
                onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
                onDragEnter={() => setDropTargetPhaseId(phase.id)}
                onDragLeave={() => setDropTargetPhaseId(null)}
                onDrop={async e => {
                  e.preventDefault()
                  setDropTargetPhaseId(null)
                  const featureId = e.dataTransfer.getData('featureId')
                  const fromPhaseId = e.dataTransfer.getData('fromPhaseId')
                  if (!featureId || fromPhaseId === phase.id) return
                  await updateFeature(featureId, { phase_id: phase.id })
                }}
              >
                {/* Phase header */}
                <div
                  onMouseDown={e => handleNodeDragStart(e, `phase-${phase.id}`, effectiveX, effectiveY)}
                  style={{ cursor: 'grab' }}
                >
                  <PhaseLaneHeader
                    phase={phase}
                    features={features}
                    accent={ac}
                    selected={isSelected}
                    onSelect={() => {
                      setSelectedId(phase.id)
                      setSelectedType('phase')
                    }}
                  />
                </div>

                {/* Feature cards inside lane */}
                <div style={{
                  padding: `${LANE_PAD}px`,
                  display: 'flex', flexDirection: 'column',
                  gap: ROW_GAP,
                }}>
                  {phaseFeatures.length === 0 ? (
                    <div style={{
                      height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 10,
                      color: 'rgba(255,255,255,0.2)', fontSize: 11,
                    }}>
                      No features yet
                    </div>
                  ) : (
                    phaseFeatures.map(feat => {
                      const featLayoutNode = layout.nodes.find(n => n.id === `feature-${feat.id}`)
                      const featOverride = nodePositions[`feature-${feat.id}`]
                      const isDragged = !!featOverride
                      return (
                        <div
                          key={feat.id}
                          data-node-id={`feature-${feat.id}`}
                          style={{
                            position: isDragged ? 'absolute' : 'relative',
                            left: isDragged ? featOverride!.x - effectiveX - LANE_PAD : undefined,
                            top: isDragged ? featOverride!.y - effectiveY - PHASE_HEADER_H - LANE_PAD : undefined,
                            zIndex: isDragged ? 10 : 'auto',
                            flexShrink: 0,
                          }}
                          onMouseDown={e => {
                            if ((e.target as HTMLElement).closest('[data-interactive]')) return
                            handleNodeDragStart(
                              e,
                              `feature-${feat.id}`,
                              featLayoutNode?.x ?? 0,
                              featLayoutNode?.y ?? 0,
                            )
                          }}
                          draggable
                          onDragStart={e => {
                            e.dataTransfer.setData('featureId', feat.id)
                            e.dataTransfer.setData('fromPhaseId', phase.id)
                            e.dataTransfer.effectAllowed = 'move'
                          }}
                        >
                          <FeatureCard
                            feature={feat}
                            accent={ac}
                            selected={selectedId === feat.id}
                            onSelect={() => {
                              setSelectedId(feat.id)
                              setSelectedType('feature')
                            }}
                            onStatusChange={status => setFeatureStatus(feat.id, status)}
                          />
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )
          })}

          {/* ── Annotation nodes ──────────────────── */}
          {annotations.map(ann => (
            <AnnotationCard
              key={ann.id}
              ann={ann}
              onUpdate={(id: string, text: string) => setAnnotations(prev =>
                prev.map(a => a.id === id ? { ...a, text } : a)
              )}
              onDelete={(id: string) => setAnnotations(prev => prev.filter(a => a.id !== id))}
              onDragEnd={(id: string, dx: number, dy: number) => setAnnotations(prev =>
                prev.map(a => a.id === id
                  ? { ...a, x: a.x + dx / zoom, y: a.y + dy / zoom }
                  : a
                )
              )}
            />
          ))}
        </div>

        {/* ── Zoom controls ─────────────────────────── */}
        <div data-interactive style={{
          position: 'absolute', bottom: 20, left: 20,
          display: 'flex', flexDirection: 'column', gap: 4, zIndex: 20,
        }}>
          {[
            { label: '+', action: () => setZoom(z => Math.min(2, z * 1.2)) },
            { label: '−', action: () => setZoom(z => Math.max(0.25, z / 1.2)) },
            { label: '⊡', action: fitView },
          ].map(({ label, action }) => (
            <button key={label} onClick={action} style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'rgba(8,8,20,0.88)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.6)',
              cursor: 'pointer', fontSize: 15, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backdropFilter: 'blur(12px)',
            }}>
              {label}
            </button>
          ))}
          <div style={{
            marginTop: 4, padding: '3px 0', textAlign: 'center',
            fontSize: 9, color: 'rgba(255,255,255,0.25)', fontWeight: 700,
          }}>
            {Math.round(zoom * 100)}%
          </div>
        </div>

        {/* ── Minimap ───────────────────────────────── */}
        <div data-interactive style={{
          position: 'absolute', bottom: 20, right: selectedId ? 380 : 20,
          zIndex: 20, transition: 'right 0.25s ease',
        }}>
          <MiniMap
            totalW={layout.totalW} totalH={layout.totalH}
            viewX={viewX} viewY={viewY} viewW={viewW} viewH={viewH}
            accent={ac} phases={phases} features={features}
            layout={layout.nodes}
          />
        </div>

        {/* ── Detail panel ──────────────────────────── */}
        {selectedId && selectedType && (
          <div
            data-interactive
            style={{
              position: 'absolute', top: 0, right: 0, bottom: 0,
              width: 360, zIndex: 30,
              background: 'rgba(8,8,20,0.96)',
              backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
              borderLeft: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <DetailPanel
              type={selectedType}
              itemId={selectedId}
              projectId={projectId}
              phases={phases}
              features={features}
              onClose={() => { setSelectedId(null); setSelectedType(null) }}
              onUpdatePhase={updatePhase}
              onUpdateFeature={updateFeature}
              onDeletePhase={deletePhase}
              onDeleteFeature={deleteFeature}
            />
          </div>
        )}
      </div>

      {/* ── Floating bottom bar ───────────────────────── */}
      <div data-interactive style={{
        position: 'absolute', bottom: 20,
        left: '50%', transform: 'translateX(-50%)',
        display: 'flex', gap: 8, zIndex: 25,
      }}>
        <button
          onClick={() => setShowAddPhase(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '10px 18px',
            background: 'rgba(8,8,20,0.92)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 12, color: '#fff',
            fontSize: 12, fontWeight: 700,
            cursor: 'pointer', backdropFilter: 'blur(16px)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
            transition: 'border-color 0.15s, background 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(96,165,250,0.4)'; e.currentTarget.style.background = 'rgba(96,165,250,0.08)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; e.currentTarget.style.background = 'rgba(8,8,20,0.92)' }}
        >
          <Layers size={13} color="#60a5fa"/> Phase
        </button>
        <button
          onClick={() => setShowAddFeature(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '10px 18px',
            background: 'rgba(8,8,20,0.92)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 12, color: '#fff',
            fontSize: 12, fontWeight: 700,
            cursor: 'pointer', backdropFilter: 'blur(16px)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
            transition: 'border-color 0.15s, background 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(167,139,250,0.4)'; e.currentTarget.style.background = 'rgba(167,139,250,0.08)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; e.currentTarget.style.background = 'rgba(8,8,20,0.92)' }}
        >
          <Box size={13} color="#a78bfa"/> Feature
        </button>
      </div>

      {/* ── Right-click annotation menu ──────────── */}
      {showAnnotationMenu && (
        <>
          <div
            data-interactive
            style={{ position: 'fixed', inset: 0, zIndex: 40 }}
            onClick={() => setShowAnnotationMenu(false)}
          />
          <div
            data-interactive
            style={{
              position: 'fixed',
              left: annotationMenuPos.x,
              top: annotationMenuPos.y,
              zIndex: 50,
              background: 'rgba(8,8,20,0.97)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 12,
              padding: '8px',
              boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
              backdropFilter: 'blur(20px)',
              minWidth: 160,
            }}
          >
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.25)', padding: '4px 8px 8px', textTransform: 'uppercase' }}>
              Add annotation
            </div>
            {ANNOTATION_KINDS.map(kind => (
              <div
                key={kind.key}
                onClick={() => {
                  // Convert screen coords to canvas coords
                  const rect = containerRef.current?.getBoundingClientRect()
                  if (!rect) return
                  const canvasX = (annotationMenuPos.x - rect.left - pan.x) / zoom
                  const canvasY = (annotationMenuPos.y - rect.top  - pan.y) / zoom
                  const newAnn: Annotation = {
                    id:     `ann-${Date.now()}`,
                    x:      canvasX,
                    y:      canvasY,
                    width:  200,
                    height: 100,
                    text:   '',
                    kind:   kind.key,
                  }
                  setAnnotations(prev => [...prev, newAnn])
                  setShowAnnotationMenu(false)
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{ fontSize: 14 }}>{kind.emoji}</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: kind.color }}>{kind.label}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Modals ────────────────────────────────────── */}
      {showAddPhase && (
        <AddPhaseModal
          onClose={() => setShowAddPhase(false)}
          onConfirm={handleCreatePhase}
          saving={modalSaving}
        />
      )}
      {showAddFeature && (
        <AddFeatureModal
          phases={phases}
          onClose={() => setShowAddFeature(false)}
          onConfirm={handleCreateFeature}
          saving={modalSaving}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
//  Export — no ReactFlowProvider needed anymore
// ─────────────────────────────────────────────────────────

export default function GraphPage() {
  return <GraphCanvas />
}
