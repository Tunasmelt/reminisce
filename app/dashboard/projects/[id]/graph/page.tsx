'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { useTheme } from '@/hooks/useTheme'
import { useProjectData } from './useProjectData'
import { DetailPanel } from './DetailPanel'
import { AddPhaseModal } from './AddPhaseModal'
import { AddFeatureModal } from './AddFeatureModal'
import { STATUS_CONFIG } from './types'
import type { Phase, Feature, StatusKey } from './types'
import {
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  useReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  MarkerType,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Layers, Box, Lock, Unlock, RefreshCw, LayoutGrid } from 'lucide-react'

// ─── Layout constants ─────────────────────────────────────────────────────────
const NODE_W      = 240
const NODE_H      = 90
const PHASE_PAD   = 20
const PHASE_HDR   = 40
const COL_GAP     = 40
const ROW_GAP     = 16
const PROJECT_Y   = 40
const PHASES_Y    = 160

function hexToRgba(hex: string, a: number) {
  if (!hex || hex.length < 7) return `rgba(245,158,11,${a})`
  const r = parseInt(hex.slice(1,3),16)
  const g = parseInt(hex.slice(3,5),16)
  const b = parseInt(hex.slice(5,7),16)
  return `rgba(${r},${g},${b},${a})`
}

// ─── Annotation kinds ─────────────────────────────────────────────────────────
const ANNOTATION_KINDS = [
  { key: 'note'    as const, label: 'Note',    color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.3)',  emoji: '📝' },
  { key: 'bug'     as const, label: 'Bug',     color: '#f87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.3)', emoji: '🐛' },
  { key: 'todo'    as const, label: 'TODO',    color: '#60a5fa', bg: 'rgba(96,165,250,0.08)',  border: 'rgba(96,165,250,0.3)',  emoji: '✅' },
  { key: 'comment' as const, label: 'Comment', color: '#a78bfa', bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.3)', emoji: '💬' },
]

// ─── Node components ──────────────────────────────────────────────────────────

function ProjectNodeComponent({ data }: { data: { label: string; featureCount: number; doneCount: number; accent: string } }) {
  const pct = data.featureCount > 0 ? Math.round((data.doneCount / data.featureCount) * 100) : 0
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      border: `1px solid ${hexToRgba(data.accent, 0.35)}`,
      borderRadius: 14, padding: '14px 20px',
      minWidth: 220, textAlign: 'center',
      boxShadow: `0 0 32px ${hexToRgba(data.accent, 0.12)}`,
      backdropFilter: 'blur(20px)',
    }}>
      <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: data.accent, marginBottom: 6 }}>Project</div>
      <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 8 }}>{data.label}</div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{data.featureCount} features · {pct}% done</div>
    </div>
  )
}

function PhaseNodeComponent({ data }: { data: { label: string; status: StatusKey; featureCount: number; doneCount: number; accent: string; orderIndex: number } }) {
  const sc = STATUS_CONFIG[data.status] ?? STATUS_CONFIG.planned
  return (
    <div style={{
      background: 'rgba(255,255,255,0.025)',
      border: `1px solid rgba(255,255,255,0.08)`,
      borderTop: `2px solid ${sc.color}`,
      borderRadius: 12, padding: '12px 16px',
      minWidth: 200,
      backdropFilter: 'blur(16px)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.3)' }}>
          {String(data.orderIndex + 1).padStart(2,'0')}
        </span>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {data.label}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>
          {sc.label}
        </span>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{data.doneCount}/{data.featureCount}</span>
      </div>
    </div>
  )
}

function FeatureNodeComponent({ data, selected }: { data: { label: string; status: StatusKey; featureType: string; accent: string; projectId: string; featureId: string; phaseId: string }; selected?: boolean }) {
  const sc = STATUS_CONFIG[data.status] ?? STATUS_CONFIG.planned
  const typeColors: Record<string, string> = {
    frontend: '#60a5fa', backend: '#34d399', database: '#f59e0b',
    testing: '#a78bfa', architecture: '#f87171',
  }
  const tc = typeColors[data.featureType] ?? 'rgba(255,255,255,0.4)'
  return (
    <div style={{
      background: selected ? hexToRgba(data.accent, 0.07) : 'rgba(255,255,255,0.025)',
      border: selected ? `1px solid ${hexToRgba(data.accent, 0.4)}` : '1px solid rgba(255,255,255,0.07)',
      borderRadius: 12, padding: '12px 14px',
      width: NODE_W, minHeight: NODE_H,
      backdropFilter: 'blur(16px)',
      boxShadow: selected ? `0 0 20px ${hexToRgba(data.accent, 0.15)}` : 'none',
      transition: 'all 0.15s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.06em', padding: '1px 5px', borderRadius: 4, background: `${tc}20`, color: tc, border: `1px solid ${tc}40`, textTransform: 'uppercase', flexShrink: 0 }}>
          {data.featureType}
        </span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 8, lineHeight: 1.3 }}>
        {data.label}
      </div>
      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>
        {sc.label}
      </span>
    </div>
  )
}

function AnnotationNodeComponent({ data }: { data: { text: string; kind: string; color: string; bg: string; border: string; emoji: string; onUpdate: (id: string, text: string) => void; onDelete: (id: string) => void; id: string } }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(data.text)
  return (
    <div style={{
      background: data.bg, border: `1px solid ${data.border}`,
      borderRadius: 10, padding: '10px 14px',
      minWidth: 160, maxWidth: 280, fontSize: 12,
      backdropFilter: 'blur(12px)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 14 }}>{data.emoji}</span>
        <span style={{ fontSize: 10, fontWeight: 800, color: data.color, flex: 1 }}>{data.kind.toUpperCase()}</span>
        <button onClick={() => data.onDelete(data.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', fontSize: 12, padding: 2 }}>✕</button>
      </div>
      {editing ? (
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={() => { data.onUpdate(data.id, draft); setEditing(false) }}
          autoFocus
          rows={3}
          style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, color: '#fff', fontSize: 12, padding: '6px 8px', resize: 'vertical', outline: 'none', fontFamily: 'inherit' }}
        />
      ) : (
        <div onClick={() => setEditing(true)} style={{ color: 'rgba(255,255,255,0.75)', lineHeight: 1.5, cursor: 'text', minHeight: 30 }}>
          {data.text || <span style={{ color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>Click to add note…</span>}
        </div>
      )}
    </div>
  )
}

const nodeTypes = {
  projectNode:    ProjectNodeComponent,
  phaseNode:      PhaseNodeComponent,
  featureNode:    FeatureNodeComponent,
  annotationNode: AnnotationNodeComponent,
}

// ─── Layout builder ───────────────────────────────────────────────────────────
function buildNodesAndEdges(
  projectName: string,
  phases: Phase[],
  features: Feature[],
  accent: string,
  savedPositions: Record<string, { x: number; y: number }>,
  annotationData: AnnotationData[],
  annotationCallbacks: {
    onUpdate: (id: string, text: string) => void
    onDelete: (id: string) => void
  },
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = []
  const edges: Edge[] = []

  const totalCols = phases.length
  const totalW = totalCols * (NODE_W + PHASE_PAD * 2) + (totalCols - 1) * COL_GAP

  // Project node
  const projId = 'project-root'
  const projPos = savedPositions[projId] ?? { x: totalW / 2 - 110, y: PROJECT_Y }
  const totalDone = features.filter(f => f.status === 'done' || f.status === 'complete').length
  nodes.push({
    id: projId, type: 'projectNode', position: projPos,
    data: { label: projectName, featureCount: features.length, doneCount: totalDone, accent },
    dragHandle: '.react-flow__node',
  })

  let curX = 0
  for (let pi = 0; pi < phases.length; pi++) {
    const phase = phases[pi]
    const pf = features.filter(f => f.phase_id === phase.id)
    const doneCount = pf.filter(f => f.status === 'done' || f.status === 'complete').length

    const phaseId = `phase-${phase.id}`
    const phasePos = savedPositions[phaseId] ?? { x: curX, y: PHASES_Y }
    nodes.push({
      id: phaseId, type: 'phaseNode', position: phasePos,
      data: { label: phase.name, status: phase.status, featureCount: pf.length, doneCount, accent, orderIndex: phase.order_index ?? pi },
    })

    edges.push({
      id: `e-project-${phase.id}`,
      source: projId, target: phaseId,
      type: 'smoothstep',
      animated: false,
      style: { stroke: hexToRgba(accent, 0.25), strokeWidth: 1.5 },
      markerEnd: { type: MarkerType.ArrowClosed, color: hexToRgba(accent, 0.4), width: 12, height: 12 },
    })

    const featStartY = PHASES_Y + PHASE_HDR + PHASE_PAD + 60
    for (let fi = 0; fi < pf.length; fi++) {
      const feat = pf[fi]
      const featId = `feature-${feat.id}`
      const defaultPos = {
        x: curX + PHASE_PAD,
        y: featStartY + fi * (NODE_H + ROW_GAP),
      }
      const featPos = savedPositions[featId] ?? defaultPos
      nodes.push({
        id: featId, type: 'featureNode', position: featPos,
        data: { label: feat.name, status: feat.status, featureType: feat.type, accent, projectId: feat.project_id, featureId: feat.id, phaseId: feat.phase_id },
      })
      edges.push({
        id: `e-${phase.id}-${feat.id}`,
        source: phaseId, target: featId,
        type: 'smoothstep',
        style: { stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 },
      })
    }

    curX += NODE_W + PHASE_PAD * 2 + COL_GAP
  }

  // Annotation nodes
  for (const ann of annotationData) {
    const kindConfig = ANNOTATION_KINDS.find(k => k.key === ann.kind) ?? ANNOTATION_KINDS[0]
    nodes.push({
      id: `ann-${ann.id}`, type: 'annotationNode',
      position: savedPositions[`ann-${ann.id}`] ?? { x: ann.x, y: ann.y },
      data: { id: ann.id, text: ann.text, kind: ann.kind, color: kindConfig.color, bg: kindConfig.bg, border: kindConfig.border, emoji: kindConfig.emoji, onUpdate: annotationCallbacks.onUpdate, onDelete: annotationCallbacks.onDelete },
    })
  }

  return { nodes, edges }
}

interface AnnotationData {
  id: string; x: number; y: number; text: string
  kind: 'note' | 'bug' | 'todo' | 'comment'
}

// ─── Main inner component (must be inside ReactFlowProvider) ──────────────────
function GraphCanvas() {
  const params = useParams()
  const projectId = params.id as string
  const { accent } = useTheme()
  const ac = accent || '#f59e0b'
  const rf = useReactFlow()

  const {
    project, phases, features, loading,
    createPhase, updatePhase, deletePhase,
    createFeature, updateFeature, deleteFeature,
  } = useProjectData(projectId)

  // ── Persisted node positions ──────────────────────────────────────────────
  const POSITIONS_KEY = `reminisce_graph_positions_${projectId}`
  const [savedPositions, setSavedPositions] = useState<Record<string, { x: number; y: number }>>(() => {
    if (typeof window === 'undefined') return {}
    try { return JSON.parse(localStorage.getItem(POSITIONS_KEY) || '{}') } catch { return {} }
  })

  // ── Annotations (persisted to localStorage) ───────────────────────────────
  const ANNOT_KEY = `reminisce_annotations_${projectId}`
  const [annotations, setAnnotations] = useState<AnnotationData[]>(() => {
    if (typeof window === 'undefined') return []
    try { return JSON.parse(localStorage.getItem(ANNOT_KEY) || '[]') } catch { return [] }
  })

  useEffect(() => {
    localStorage.setItem(ANNOT_KEY, JSON.stringify(annotations))
  }, [annotations, ANNOT_KEY])

  const annotationCallbacks = useMemo(() => ({
    onUpdate: (id: string, text: string) => setAnnotations(prev => prev.map(a => a.id === id ? { ...a, text } : a)),
    onDelete: (id: string) => setAnnotations(prev => prev.filter(a => a.id !== id)),
  }), [])

  // ── ReactFlow state ────────────────────────────────────────────────────────
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])

  // ── Selection ─────────────────────────────────────────────────────────────
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedType, setSelectedType] = useState<'phase' | 'feature' | null>(null)

  // ── UI state ──────────────────────────────────────────────────────────────
  const [showAddPhase, setShowAddPhase] = useState(false)
  const [showAddFeature, setShowAddFeature] = useState(false)
  const [modalSaving, setModalSaving] = useState(false)
  const [locked, setLocked] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; canvasX: number; canvasY: number } | null>(null)

  // ── Build nodes/edges from data ───────────────────────────────────────────
  useEffect(() => {
    if (loading || !project) return
    const { nodes: n, edges: e } = buildNodesAndEdges(
      project.name, phases, features, ac,
      savedPositions, annotations, annotationCallbacks
    )
    setNodes(n)
    setEdges(e)
  }, [project, phases, features, ac, loading, annotations, annotationCallbacks, setNodes, setEdges, savedPositions])
  // Note: savedPositions intentionally excluded — only rebuild layout on data change

  // ── Fit view on first load ────────────────────────────────────────────────
  const fitted = useRef(false)
  useEffect(() => {
    if (!loading && phases.length > 0 && !fitted.current) {
      setTimeout(() => {
        rf.fitView({ padding: 0.15, duration: 400 })
        fitted.current = true
      }, 100)
    }
  }, [loading, phases.length, rf])

  // ── Node drag stop — save position ────────────────────────────────────────
  const onNodeDragStop = useCallback((_: unknown, node: Node) => {
    setSavedPositions(prev => {
      const updated = { ...prev, [node.id]: { x: node.position.x, y: node.position.y } }
      localStorage.setItem(POSITIONS_KEY, JSON.stringify(updated))
      return updated
    })
  }, [POSITIONS_KEY])

  // ── Node click — select for detail panel ─────────────────────────────────
  const onNodeClick = useCallback<NodeMouseHandler>((_: unknown, node: Node) => {
    if (node.type === 'featureNode') {
      const featureId = (node.data as { featureId: string }).featureId
      setSelectedNodeId(featureId)
      setSelectedType('feature')
    } else if (node.type === 'phaseNode') {
      const phaseId = (node.data as { phaseId?: string }).phaseId ?? node.id.replace('phase-', '')
      setSelectedNodeId(phaseId)
      setSelectedType('phase')
    } else {
      setSelectedNodeId(null)
      setSelectedType(null)
    }
  }, [])

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null)
    setSelectedType(null)
    setContextMenu(null)
  }, [])

  // ── Right-click to add annotation ─────────────────────────────────────────
  const onPaneContextMenu = useCallback((e: MouseEvent | React.MouseEvent) => {
    e.preventDefault()
    const mouseEvent = 'clientX' in e ? e : (e as React.MouseEvent).nativeEvent
    const flowPos = rf.screenToFlowPosition({ x: mouseEvent.clientX, y: mouseEvent.clientY })
    setContextMenu({ x: mouseEvent.clientX, y: mouseEvent.clientY, canvasX: flowPos.x, canvasY: flowPos.y })
  }, [rf])

  const addAnnotation = useCallback((kind: AnnotationData['kind']) => {
    if (!contextMenu) return
    const ann: AnnotationData = {
      id: `${Date.now()}`, x: contextMenu.canvasX, y: contextMenu.canvasY,
      text: '', kind,
    }
    setAnnotations(prev => [...prev, ann])
    setContextMenu(null)
  }, [contextMenu])

  // ── Feature-to-phase reparent on drop ─────────────────────────────────────
  const onConnect = useCallback(() => {
    // Not used for manual connections — just here to satisfy ReactFlow types
  }, [])

  // ── Mutations ─────────────────────────────────────────────────────────────
  const handleCreatePhase = useCallback(async (name: string, desc: string) => {
    setModalSaving(true)
    await createPhase({ name, description: desc })
    setModalSaving(false)
    setShowAddPhase(false)
  }, [createPhase])

  const handleCreateFeature = useCallback(async (input: { name: string; description: string; type: string; phaseId: string }) => {
    setModalSaving(true)
    await createFeature({ name: input.name, description: input.description, type: input.type as 'frontend', phaseId: input.phaseId })
    setModalSaving(false)
    setShowAddFeature(false)
  }, [createFeature])

  // ── Reset layout ──────────────────────────────────────────────────────────
  const resetLayout = useCallback(() => {
    setSavedPositions({})
    localStorage.removeItem(POSITIONS_KEY)
    fitted.current = false
    if (!project) return
    const { nodes: n, edges: e } = buildNodesAndEdges(
      project.name, phases, features, ac, {}, annotations, annotationCallbacks
    )
    setNodes(n)
    setEdges(e)
    setTimeout(() => rf.fitView({ padding: 0.15, duration: 400 }), 50)
  }, [project, phases, features, ac, annotations, annotationCallbacks, POSITIONS_KEY, rf, setNodes, setEdges])

  if (loading) return (
    <div style={{ height: 'calc(100vh - 68px)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#05050f' }}>
      <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Loading graph…</div>
    </div>
  )

  return (
    <div style={{ height: 'calc(100vh - 68px)', background: '#05050f', position: 'relative' }}>
      {/* Top bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
        height: 52, display: 'flex', alignItems: 'center',
        padding: '0 16px', gap: 8,
        background: 'rgba(5,5,15,0.85)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginRight: 4 }}>
          {project?.name}
        </span>
        <div style={{ flex: 1 }}/>
        {/* Stats */}
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
          {features.filter(f => f.status==='done'||f.status==='complete').length} done · {features.filter(f=>f.status==='in_progress').length} active · {features.length > 0 ? Math.round(features.filter(f=>f.status==='done'||f.status==='complete').length/features.length*100) : 0}%
        </span>
        {/* Lock toggle */}
        <button
          onClick={() => setLocked(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '5px 12px', borderRadius: 8,
            background: locked ? hexToRgba(ac, 0.1) : 'rgba(255,255,255,0.04)',
            border: `1px solid ${locked ? hexToRgba(ac, 0.25) : 'rgba(255,255,255,0.08)'}`,
            color: locked ? ac : 'rgba(255,255,255,0.5)',
            fontSize: 11, fontWeight: 700, cursor: 'pointer',
          }}
        >
          {locked ? <Lock size={11}/> : <Unlock size={11}/>}
          {locked ? 'Locked' : 'Free'}
        </button>
        {/* Reset layout */}
        <button onClick={resetLayout} style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '5px 12px', borderRadius: 8,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          color: 'rgba(255,255,255,0.5)',
          fontSize: 11, fontWeight: 700, cursor: 'pointer',
        }}>
          <RefreshCw size={11}/> Reset
        </button>
        {/* Board link */}
        <a href={`/dashboard/projects/${projectId}/board`} style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '5px 12px', borderRadius: 8,
          background: hexToRgba(ac, 0.08),
          border: `1px solid ${hexToRgba(ac, 0.2)}`,
          color: ac, fontSize: 11, fontWeight: 700,
          textDecoration: 'none',
        }}>
          <LayoutGrid size={11}/> Board
        </a>
      </div>

      {/* ReactFlow */}
      <div style={{ position: 'absolute', inset: 0, paddingTop: 52 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          onNodeDragStop={onNodeDragStop}
          onPaneClick={onPaneClick}
          onPaneContextMenu={onPaneContextMenu}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          nodesDraggable={!locked}
          panOnDrag={true}
          zoomOnPinch={true}
          zoomOnScroll={true}
          zoomOnDoubleClick={false}
          preventScrolling={true}
          minZoom={0.1}
          maxZoom={2.5}
          fitView={false}
          colorMode="dark"
          style={{ background: '#05050f' }}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="rgba(255,255,255,0.05)"/>
          <Controls
            style={{ background: 'rgba(8,8,20,0.85)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10 }}
            showFitView={true}
            position="bottom-left"
          />
          <MiniMap
            nodeColor={n => {
              if (n.type === 'projectNode') return ac
              if (n.type === 'phaseNode') return '#3b82f6'
              if (n.type === 'featureNode') return '#8b5cf6'
              return '#f59e0b'
            }}
            style={{ background: 'rgba(8,8,20,0.85)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10 }}
            position="bottom-right"
          />

          {/* Add buttons panel */}
          <Panel position="bottom-center">
            <div style={{ display: 'flex', gap: 8, paddingBottom: 8 }}>
              <button onClick={() => setShowAddPhase(true)} style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '10px 18px', background: 'rgba(8,8,20,0.92)',
                border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12,
                color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                backdropFilter: 'blur(16px)', boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(96,165,250,0.5)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)' }}
              >
                <Layers size={13} color="#60a5fa"/> Phase
              </button>
              <button onClick={() => setShowAddFeature(true)} style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '10px 18px', background: 'rgba(8,8,20,0.92)',
                border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12,
                color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                backdropFilter: 'blur(16px)', boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(167,139,250,0.5)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)' }}
              >
                <Box size={13} color="#a78bfa"/> Feature
              </button>
            </div>
          </Panel>
        </ReactFlow>
      </div>

      {/* Right-click context menu */}
      {contextMenu && (
        <>
          <div onClick={() => setContextMenu(null)} style={{ position: 'fixed', inset: 0, zIndex: 40 }}/>
          <div style={{
            position: 'fixed', left: contextMenu.x, top: contextMenu.y,
            zIndex: 50, background: 'rgba(8,8,20,0.97)',
            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12,
            padding: 8, boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
            backdropFilter: 'blur(20px)', minWidth: 160,
          }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.25)', padding: '4px 8px 8px', textTransform: 'uppercase' }}>
              Add annotation
            </div>
            {ANNOTATION_KINDS.map(kind => (
              <div key={kind.key} onClick={() => addAnnotation(kind.key)} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{ fontSize: 14 }}>{kind.emoji}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: kind.color }}>{kind.label}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Detail panel */}
      {selectedNodeId && selectedType && (
        <div style={{
          position: 'absolute', top: 52, right: 0, bottom: 0, width: 360,
          zIndex: 30, background: 'rgba(8,8,20,0.96)',
          backdropFilter: 'blur(24px)', borderLeft: '1px solid rgba(255,255,255,0.08)',
        }}>
          <DetailPanel
            type={selectedType}
            itemId={selectedNodeId}
            projectId={projectId}
            phases={phases}
            features={features}
            onClose={() => { setSelectedNodeId(null); setSelectedType(null) }}
            onUpdatePhase={updatePhase}
            onUpdateFeature={updateFeature}
            onDeletePhase={deletePhase}
            onDeleteFeature={deleteFeature}
          />
        </div>
      )}

      {/* Modals */}
      {showAddPhase && (
        <AddPhaseModal onClose={() => setShowAddPhase(false)} onConfirm={handleCreatePhase} saving={modalSaving}/>
      )}
      {showAddFeature && (
        <AddFeatureModal phases={phases} onClose={() => setShowAddFeature(false)} onConfirm={handleCreateFeature} saving={modalSaving}/>
      )}
    </div>
  )
}

// ─── Export (wrapped in ReactFlowProvider) ────────────────────────────────────
export default function GraphPage() {
  return (
    <ReactFlowProvider>
      <GraphCanvas />
    </ReactFlowProvider>
  )
}
