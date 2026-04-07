'use client'

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useParams } from 'next/navigation'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  Handle,
  Position,
  NodeProps,
  Edge,
  Node,
  BackgroundVariant,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import dagre from '@dagrejs/dagre'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import {
  Plus, Layers, Box, Target, Network,
  LayoutGrid, RefreshCw, Maximize2,
} from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import { useProjectData } from './useProjectData'
import { DetailPanel } from './DetailPanel'
import { AddPhaseModal } from './AddPhaseModal'
import { AddFeatureModal } from './AddFeatureModal'
import { StatusBadge, FeatureTypeBadge, ProgressRing } from './StatusBadge'
import type {
  PhaseNodeData,
  FeatureNodeData,
  ProjectNodeData,
} from './types'

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
//  Custom Node Components — pure inline glass styles
// ─────────────────────────────────────────────────────────

const ProjectNode = ({ data }: NodeProps) => {
  const d = data as unknown as ProjectNodeData
  return (
    <div style={{
      padding: '16px 20px',
      minWidth: 220,
      background: 'rgba(8,8,20,0.92)',
      backdropFilter: 'blur(20px)',
      border: '1px solid var(--accent-primary)',
      borderRadius: 14,
      boxShadow: '0 0 28px var(--accent-glow), 0 8px 32px rgba(0,0,0,0.5)',
      transition: 'all 0.2s ease',
    }}>
      <Handle type="source" position={Position.Bottom}
        style={{ background: 'var(--accent-primary)', width: 8, height: 8, border: '2px solid #000' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Target size={13} color="var(--accent-primary)" />
        <span style={{
          fontSize: 8, fontWeight: 800,
          color: 'var(--accent-primary)',
          letterSpacing: '0.2em', textTransform: 'uppercase',
        }}>Project</span>
      </div>
      <div style={{
        fontSize: 16, fontWeight: 800,
        color: '#fff', letterSpacing: '-0.01em',
        marginBottom: 6,
      }}>
        {d.label}
      </div>
      <div style={{
        fontSize: 10, color: 'rgba(255,255,255,0.3)',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span>{d.featureCount ?? 0} features</span>
        <span style={{ color: 'rgba(255,255,255,0.15)' }}>·</span>
        <span style={{ color: '#34d399' }}>{d.doneCount ?? 0} done</span>
      </div>
    </div>
  )
}

const PhaseNode = ({ data }: NodeProps) => {
  const d = data as unknown as PhaseNodeData
  return (
    <div style={{
      padding: '14px 18px',
      minWidth: 200,
      background: 'rgba(8,8,20,0.9)',
      backdropFilter: 'blur(16px)',
      border: '1px solid rgba(59,130,246,0.45)',
      borderRadius: 14,
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      transition: 'all 0.2s ease',
    }}>
      <Handle type="target" position={Position.Top}
        style={{ background: '#60a5fa', width: 7, height: 7, border: '2px solid #000' }} />
      <Handle type="source" position={Position.Bottom}
        style={{ background: '#60a5fa', width: 7, height: 7, border: '2px solid #000' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
        <Layers size={12} color="#60a5fa" />
        <span style={{
          fontSize: 8, fontWeight: 800,
          color: '#60a5fa',
          letterSpacing: '0.18em', textTransform: 'uppercase',
        }}>Phase</span>
        <div style={{ marginLeft: 'auto' }}>
          <ProgressRing
            total={d.featureCount ?? 0}
            done={d.doneCount ?? 0}
            size={24}
            color="#34d399"
          />
        </div>
      </div>
      <div style={{
        fontSize: 13, fontWeight: 700,
        color: '#fff', marginBottom: 4,
        letterSpacing: '-0.01em',
      }}>
        {d.label}
      </div>
      {d.description && (
        <div style={{
          fontSize: 10, color: 'rgba(255,255,255,0.35)',
          lineHeight: 1.4, marginBottom: 8,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {d.description}
        </div>
      )}
      <StatusBadge status={d.status ?? 'planned'} />
    </div>
  )
}

const FeatureNode = ({ data }: NodeProps) => {
  const d = data as unknown as FeatureNodeData
  return (
    <div style={{
      padding: '12px 16px',
      minWidth: 180,
      background: 'rgba(8,8,20,0.9)',
      backdropFilter: 'blur(16px)',
      border: '1px solid rgba(139,92,246,0.4)',
      borderRadius: 14,
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      transition: 'all 0.2s ease',
    }}>
      <Handle type="target" position={Position.Top}
        style={{ background: '#a78bfa', width: 7, height: 7, border: '2px solid #000' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
        <Box size={11} color="#a78bfa" />
        <span style={{
          fontSize: 8, fontWeight: 800,
          color: '#a78bfa',
          letterSpacing: '0.18em', textTransform: 'uppercase',
        }}>Feature</span>
        <span style={{
          marginLeft: 'auto',
          fontSize: 9, fontWeight: 700,
          color: 'rgba(255,255,255,0.2)',
          fontFamily: 'ui-monospace, monospace',
        }}>
          #{d.priority}
        </span>
      </div>
      <div style={{
        fontSize: 12, fontWeight: 700,
        color: '#fff', marginBottom: 8,
        letterSpacing: '-0.01em',
        lineHeight: 1.3,
      }}>
        {d.label}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
        <StatusBadge status={d.status ?? 'planned'} />
        <FeatureTypeBadge type={d.featureType} />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
//  Dagre layout engine
// ─────────────────────────────────────────────────────────

const NODE_SIZES = {
  projectNode:  { w: 240, h: 100 },
  phaseNode:    { w: 220, h: 130 },
  featureNode:  { w: 200, h: 110 },
}

function getLayoutedElements(nodes: Node[], edges: Edge[]) {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'TB', ranksep: 90, nodesep: 40, marginx: 60, marginy: 60 })

  nodes.forEach(node => {
    const type = node.type as keyof typeof NODE_SIZES
    const size = NODE_SIZES[type] ?? NODE_SIZES.featureNode
    g.setNode(node.id, { width: size.w, height: size.h })
  })
  edges.forEach(edge => g.setEdge(edge.source, edge.target))
  dagre.layout(g)

  return {
    nodes: nodes.map(node => {
      const type = node.type as keyof typeof NODE_SIZES
      const size = NODE_SIZES[type] ?? NODE_SIZES.featureNode
      const pos = g.node(node.id)
      return {
        ...node,
        position: { x: pos.x - size.w / 2, y: pos.y - size.h / 2 },
      }
    }),
    edges,
  }
}

// ─────────────────────────────────────────────────────────
//  Inner graph component (needs ReactFlowProvider above)
// ─────────────────────────────────────────────────────────

function GraphInner() {
  const params = useParams()
  const projectId = params.id as string
  const { accent } = useTheme()
  const { fitView } = useReactFlow()

  const {
    project, phases, features, loading,
    createPhase, updatePhase, deletePhase,
    createFeature, updateFeature, deleteFeature,
  } = useProjectData(projectId)

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [graphReady, setGraphReady] = useState(false)

  // Panel state
  const [selectedType, setSelectedType] =
    useState<'phase' | 'feature' | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Modal state
  const [showAddPhase, setShowAddPhase] = useState(false)
  const [showAddFeature, setShowAddFeature] = useState(false)
  const [modalSaving, setModalSaving] = useState(false)

  // Node types memoised to prevent React Flow re-registration
  const nodeTypes = useMemo(() => ({
    projectNode: ProjectNode,
    phaseNode: PhaseNode,
    featureNode: FeatureNode,
  }), [])

  // ── Build graph from data ─────────────────────────────

  const buildGraph = useCallback((
    proj: typeof project,
    phasesData: typeof phases,
    featuresData: typeof features,
    savedPositions: Map<string, { x: number, y: number }>
  ) => {
    if (!proj || phasesData.length === 0) {
      setNodes([])
      setEdges([])
      return
    }

    const rfNodes: Node[] = []
    const rfEdges: Edge[] = []

    const projKey = `project-${proj.id}`
    const projPos = savedPositions.get(projKey)
    rfNodes.push({
      id: projKey,
      type: 'projectNode',
      position: projPos ?? { x: 400, y: 50 },
      data: {
        label: proj.name,
        featureCount: featuresData.length,
        doneCount: featuresData.filter(
          f => f.status === 'done' || f.status === 'complete'
        ).length,
      } as ProjectNodeData,
    })

    phasesData.forEach((phase, pIdx) => {
      const phaseKey = `phase-${phase.id}`
      const phaseFeats = featuresData.filter(f => f.phase_id === phase.id)
      const phaseDone = phaseFeats.filter(
        f => f.status === 'done' || f.status === 'complete'
      ).length
      const phasePos = savedPositions.get(phaseKey)

      rfNodes.push({
        id: phaseKey,
        type: 'phaseNode',
        position: phasePos ?? { x: pIdx * 340, y: 220 },
        data: {
          label: phase.name,
          description: phase.description,
          status: phase.status ?? 'planned',
          phaseId: phase.id,
          featureCount: phaseFeats.length,
          doneCount: phaseDone,
          orderIndex: phase.order_index,
        } as PhaseNodeData,
      })

      rfEdges.push({
        id: `e-proj-phase-${phase.id}`,
        source: projKey,
        target: phaseKey,
        animated: true,
        style: { stroke: '#3b82f6', strokeWidth: 1.5, opacity: 0.5 },
      })

      phaseFeats.forEach((feature, fIdx) => {
        const featKey = `feature-${feature.id}`
        const featPos = savedPositions.get(featKey)
        const fallback = {
          x: (pIdx * 340) + (fIdx % 2 === 0 ? -120 : 120),
          y: 420 + Math.floor(fIdx / 2) * 160,
        }

        rfNodes.push({
          id: featKey,
          type: 'featureNode',
          position: featPos ?? fallback,
          data: {
            label: feature.name,
            description: feature.description,
            featureType: feature.type,
            status: feature.status ?? 'planned',
            featureId: feature.id,
            phaseId: feature.phase_id,
            priority: feature.priority,
            projectId,
          } as FeatureNodeData,
        })

        rfEdges.push({
          id: `e-phase-feat-${feature.id}`,
          source: phaseKey,
          target: featKey,
          animated: true,
          style: { stroke: '#8b5cf6', strokeWidth: 1.5, opacity: 0.5 },
        })
      })
    })

    const { nodes: laid, edges: laidE } = getLayoutedElements(rfNodes, rfEdges)
    setNodes(laid)
    setEdges(laidE)
  }, [projectId, setNodes, setEdges])

  // ── Load saved positions + build ──────────────────────

  const initialised = useRef(false)

  useEffect(() => {
    if (loading || initialised.current) return
    initialised.current = true

    const load = async () => {
      const { data: savedNodes } = await supabase
        .from('graph_nodes')
        .select('*')
        .eq('project_id', projectId)

      const posMap = new Map<string, { x: number; y: number }>()
      savedNodes?.forEach(n => {
        const key = n.metadata?.original_id
        if (key) posMap.set(key, { x: n.position_x, y: n.position_y })
      })

      buildGraph(project, phases, features, posMap)
      setGraphReady(true)
    }
    load()
  }, [loading, project, phases, features, projectId, buildGraph])

  // Rebuild graph reactively when data changes after initial load
  useEffect(() => {
    if (!graphReady || loading) return
    // Don't reload positions — keep current node positions
    const posMap = new Map<string, { x: number; y: number }>()
    nodes.forEach(n => posMap.set(n.id, n.position))
    buildGraph(project, phases, features, posMap)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phases, features])

  // ── Save node position on drag stop ──────────────────

  const onNodeDragStop = useCallback(async (
    _: React.MouseEvent, node: Node
  ) => {
    try {
      const { data: existing } = await supabase
        .from('graph_nodes')
        .select('id')
        .eq('project_id', projectId)
        .contains('metadata', { original_id: node.id })
        .maybeSingle()

      if (existing) {
        await supabase.from('graph_nodes')
          .update({ position_x: node.position.x, position_y: node.position.y })
          .eq('id', existing.id)
      } else {
        const typeSlug = node.type?.replace('Node', '') ?? 'unknown'
        await supabase.from('graph_nodes').insert({
          project_id: projectId,
          type: typeSlug,
          label: node.data.label as string,
          status: (node.data.status as string) ?? 'planned',
          position_x: node.position.x,
          position_y: node.position.y,
          metadata: { original_id: node.id },
        })
      }
    } catch (err) {
      console.error('Failed to save node position:', err)
    }
  }, [projectId])

  // ── Node click → open detail panel ───────────────────

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (node.type === 'phaseNode') {
      const d = node.data as unknown as PhaseNodeData
      setSelectedType('phase')
      setSelectedId(d.phaseId)
    } else if (node.type === 'featureNode') {
      const d = node.data as unknown as FeatureNodeData
      setSelectedType('feature')
      setSelectedId(d.featureId)
    }
  }, [])

  // ── Reset layout ──────────────────────────────────────

  const handleResetLayout = useCallback(async () => {
    // Clear saved positions then rebuild with dagre
    await supabase.from('graph_nodes')
      .delete().eq('project_id', projectId)
    initialised.current = false
    buildGraph(project, phases, features, new Map())
    setTimeout(() => fitView({ padding: 0.15, duration: 400 }), 100)
    toast.success('Layout reset')
  }, [project, phases, features, projectId, buildGraph, fitView])

  // ── Progress stats ────────────────────────────────────

  const stats = useMemo(() => {
    const total = features.length
    const done = features.filter(
      f => f.status === 'done' || f.status === 'complete'
    ).length
    const inProgress = features.filter(
      f => f.status === 'in_progress'
    ).length
    const blocked = features.filter(
      f => f.status === 'blocked'
    ).length
    const pct = total > 0 ? Math.round((done / total) * 100) : 0
    return { total, done, inProgress, blocked, pct }
  }, [features])

  // ── Modal handlers ────────────────────────────────────

  const handleCreatePhase = async (name: string, description: string) => {
    setModalSaving(true)
    const result = await createPhase({ name, description })
    setModalSaving(false)
    if (result) setShowAddPhase(false)
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
    setModalSaving(false)
    if (result) setShowAddFeature(false)
  }

  // ── Loading / empty states ────────────────────────────

  if (loading) return (
    <div style={{
      height: 'calc(100vh - 68px)',
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
      padding: 24,
      background: '#07070f',
    }}>
      {[1, 2].map(i => (
        <div key={i} style={{
          height: i === 1 ? 40 : '100%',
          background: 'rgba(255,255,255,0.04)',
          borderRadius: 12,
          animation: 'skeletonPulse 1.5s ease infinite',
        }} />
      ))}
    </div>
  )

  if (!loading && nodes.length === 0) return (
    <div style={{
      height: 'calc(100vh - 68px)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 20,
      padding: 40,
      background: 'linear-gradient(160deg, rgba(var(--accent-rgb),0.04) 0%, transparent 50%), #07070f',
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: 18,
        background: 'rgba(var(--accent-rgb), 0.06)',
        border: '1px solid rgba(var(--accent-rgb), 0.15)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Network size={28} color={hexToRgba(accent, 0.5)} />
      </div>
      <div style={{ textAlign: 'center', maxWidth: 360 }}>
        <h3 style={{
          fontSize: 20, fontWeight: 800,
          color: '#fff', marginBottom: 8,
          letterSpacing: '-0.01em',
        }}>
          No graph yet
        </h3>
        <p style={{
          fontSize: 13,
          color: 'rgba(255,255,255,0.4)',
          lineHeight: 1.7, marginBottom: 24,
        }}>
          Run the Wizard to auto-generate your project architecture,
          or add phases manually below.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => window.location.href =
              `/dashboard/projects/${projectId}/wizard`}
            style={{
              padding: '10px 22px',
              background: accent, color: '#000',
              border: 'none', borderRadius: 10,
              fontSize: 12, fontWeight: 800,
              cursor: 'pointer',
              boxShadow: `0 0 20px ${hexToRgba(accent, 0.3)}`,
            }}
          >
            Open Wizard →
          </button>
          <button
            onClick={() => setShowAddPhase(true)}
            style={{
              padding: '10px 22px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 10, color: '#fff',
              fontSize: 12, fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            + Add Phase Manually
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
      <title>{`Reminisce — Graph — ${project?.name}`}</title>

      {/* Inline keyframe for pulse animation */}
      <style>{`
        @keyframes agentPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.85); }
        }
      `}</style>

      {/* ── Top bar ──────────────────────────────────── */}
      <div style={{
        height: 52,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        gap: 10,
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
          marginRight: 4,
        }}>
          {project?.name}
        </div>

        <div style={{
          width: 1, height: 16,
          background: 'rgba(255,255,255,0.1)',
          marginRight: 4,
        }} />

        {/* Add Phase */}
        <button
          onClick={() => setShowAddPhase(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 14px',
            background: 'rgba(59,130,246,0.1)',
            border: '1px solid rgba(59,130,246,0.25)',
            borderRadius: 8,
            color: '#60a5fa',
            fontSize: 11, fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(59,130,246,0.18)'
            e.currentTarget.style.borderColor = 'rgba(59,130,246,0.4)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(59,130,246,0.1)'
            e.currentTarget.style.borderColor = 'rgba(59,130,246,0.25)'
          }}
        >
          <Layers size={12} />
          Add Phase
        </button>

        {/* Add Feature */}
        <button
          onClick={() => setShowAddFeature(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 14px',
            background: 'rgba(139,92,246,0.1)',
            border: '1px solid rgba(139,92,246,0.25)',
            borderRadius: 8,
            color: '#a78bfa',
            fontSize: 11, fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(139,92,246,0.18)'
            e.currentTarget.style.borderColor = 'rgba(139,92,246,0.4)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(139,92,246,0.1)'
            e.currentTarget.style.borderColor = 'rgba(139,92,246,0.25)'
          }}
        >
          <Box size={12} />
          Add Feature
        </button>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Reset Layout */}
        <button
          onClick={handleResetLayout}
          title="Reset to auto-layout"
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '6px 12px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.09)',
            borderRadius: 8,
            color: 'rgba(255,255,255,0.4)',
            fontSize: 11, fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
            e.currentTarget.style.color = '#fff'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
            e.currentTarget.style.color = 'rgba(255,255,255,0.4)'
          }}
        >
          <RefreshCw size={11} /> Reset Layout
        </button>

        {/* Fit view */}
        <button
          onClick={() => fitView({ padding: 0.15, duration: 400 })}
          title="Fit all nodes in view"
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '6px 12px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.09)',
            borderRadius: 8,
            color: 'rgba(255,255,255,0.4)',
            fontSize: 11, fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
            e.currentTarget.style.color = '#fff'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
            e.currentTarget.style.color = 'rgba(255,255,255,0.4)'
          }}
        >
          <Maximize2 size={11} /> Fit View
        </button>

        {/* Board link */}
        <a
          href={`/dashboard/projects/${projectId}/board`}
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
          onMouseEnter={e => {
            e.currentTarget.style.background = hexToRgba(accent, 0.16)
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = hexToRgba(accent, 0.08)
          }}
        >
          <LayoutGrid size={11} /> Board View
        </a>
      </div>

      {/* ── Canvas + detail panel ─────────────────────── */}
      <div style={{
        flex: 1,
        position: 'relative',
        overflow: 'hidden',
      }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDragStop={onNodeDragStop}
          onNodeClick={onNodeClick}
          onPaneClick={() => {
            setSelectedType(null)
            setSelectedId(null)
          }}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          minZoom={0.1}
          maxZoom={2.5}
          snapToGrid
          snapGrid={[16, 16]}
          colorMode="dark"
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={36}
            size={1}
            color="#1a1a2e"
          />
          <Controls
            showFitView={false}
            style={{
              background: 'rgba(8,8,20,0.85)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 10,
              overflow: 'hidden',
            }}
          />
          <MiniMap
            nodeColor={n =>
              n.type === 'projectNode'
                ? accent
                : n.type === 'phaseNode'
                ? '#3b82f6'
                : '#8b5cf6'
            }
            maskColor="rgba(0,0,0,0.7)"
            style={{
              background: 'rgba(8,8,20,0.85)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 10,
            }}
          />
        </ReactFlow>

        {/* Progress overlay — top left */}
        <div style={{
          position: 'absolute',
          top: 16, left: 16,
          zIndex: 10,
          background: 'rgba(8,8,20,0.88)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.09)',
          borderRadius: 14,
          padding: '14px 18px',
          minWidth: 220,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 10,
          }}>
            <span style={{
              fontSize: 9, fontWeight: 800,
              color: 'rgba(255,255,255,0.35)',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
            }}>
              Progress
            </span>
            <span style={{
              fontSize: 14, fontWeight: 900,
              color: accent, fontVariantNumeric: 'tabular-nums',
            }}>
              {stats.pct}%
            </span>
          </div>
          <div style={{
            height: 6,
            background: 'rgba(255,255,255,0.07)',
            borderRadius: 999,
            overflow: 'hidden',
            marginBottom: 12,
            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.4)',
          }}>
            <div style={{
              height: '100%',
              width: `${stats.pct}%`,
              background: accent,
              borderRadius: 999,
              transition: 'width 0.6s ease',
              boxShadow: `0 0 8px ${hexToRgba(accent, 0.5)}`,
            }} />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {[
              { label: 'Done',    val: stats.done,       color: '#34d399' },
              { label: 'Active',  val: stats.inProgress, color: accent },
              { label: 'Blocked', val: stats.blocked,    color: '#f87171' },
              { label: 'Total',   val: stats.total,      color: 'rgba(255,255,255,0.3)' },
            ].map(s => (
              <div key={s.label} style={{ flex: 1 }}>
                <div style={{
                  fontSize: 15, fontWeight: 800,
                  color: s.color, lineHeight: 1,
                  marginBottom: 3,
                }}>
                  {s.val}
                </div>
                <div style={{
                  fontSize: 8,
                  color: 'rgba(255,255,255,0.25)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  fontWeight: 700,
                }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Detail panel — right side overlay */}
        {selectedType && selectedId && (
          <DetailPanel
            type={selectedType}
            itemId={selectedId}
            projectId={projectId}
            phases={phases}
            features={features}
            onClose={() => {
              setSelectedType(null)
              setSelectedId(null)
            }}
            onUpdatePhase={updatePhase}
            onDeletePhase={deletePhase}
            onUpdateFeature={updateFeature}
            onDeleteFeature={deleteFeature}
          />
        )}
      </div>

      {/* ── Plus button overlay — bottom centre ──────── */}
      <div style={{
        position: 'absolute',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 15,
        display: 'flex',
        gap: 10,
      }}>
        <button
          onClick={() => setShowAddPhase(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '10px 20px',
            background: 'rgba(8,8,20,0.9)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(59,130,246,0.3)',
            borderRadius: 999,
            color: '#60a5fa',
            fontSize: 12, fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(59,130,246,0.15)'
            e.currentTarget.style.borderColor = 'rgba(59,130,246,0.5)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(8,8,20,0.9)'
            e.currentTarget.style.borderColor = 'rgba(59,130,246,0.3)'
          }}
        >
          <Plus size={13} />
          <Layers size={13} />
          Phase
        </button>

        <button
          onClick={() => setShowAddFeature(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '10px 20px',
            background: 'rgba(8,8,20,0.9)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(139,92,246,0.3)',
            borderRadius: 999,
            color: '#a78bfa',
            fontSize: 12, fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(139,92,246,0.15)'
            e.currentTarget.style.borderColor = 'rgba(139,92,246,0.5)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(8,8,20,0.9)'
            e.currentTarget.style.borderColor = 'rgba(139,92,246,0.3)'
          }}
        >
          <Plus size={13} />
          <Box size={13} />
          Feature
        </button>
      </div>

      {/* ── Modals ───────────────────────────────────── */}
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
//  Export — wrapped in ReactFlowProvider (required for
//  useReactFlow hook inside GraphInner)
// ─────────────────────────────────────────────────────────

export default function GraphPage() {
  return (
    <ReactFlowProvider>
      <GraphInner />
    </ReactFlowProvider>
  )
}
