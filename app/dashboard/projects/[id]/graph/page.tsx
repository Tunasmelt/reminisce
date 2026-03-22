'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
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
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { 
  Maximize, 
  Play, 
  Target,
  Box,
  Layers,
  Network,
  Terminal,
} from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'

// --- Custom Node Components ---

const ProjectNode = ({ data }: NodeProps) => (
  <div className="px-6 py-5 shadow-[0_0_30px_var(--accent-glow)] rounded-rem-md bg-reminisce-bg-surface border border-[var(--accent-primary)] min-w-[240px] group transition-all">
    <Handle type="source" position={Position.Bottom} className="w-2.5 h-2.5 bg-[var(--accent-primary)] border-2 border-black" />
    <div className="flex items-center gap-3 mb-2">
      <Target className="w-4 h-4 text-[var(--accent-primary)]" />
      <span className="text-[9px] font-black text-[var(--accent-primary)] uppercase tracking-[0.3em]">Project Master</span>
    </div>
    <div className="text-2xl font-black text-white tracking-tighter uppercase italic">{data.label as string}</div>
  </div>
)

const PhaseNode = ({ data }: NodeProps) => (
  <div className="px-6 py-5 shadow-2xl rounded-rem-md bg-reminisce-bg-surface border border-reminisce-accent-blue min-w-[220px] group transition-all">
    <Handle type="target" position={Position.Top} className="w-2.5 h-2.5 bg-reminisce-accent-blue border-2 border-black" />
    <Handle type="source" position={Position.Bottom} className="w-2.5 h-2.5 bg-reminisce-accent-blue border-2 border-black" />
    <div className="flex items-center gap-3 mb-2">
      <Layers className="w-4 h-4 text-reminisce-accent-blue" />
      <span className="text-[9px] font-black text-reminisce-accent-blue uppercase tracking-[0.3em]">Lifecycle Phase</span>
    </div>
    <div className="text-lg font-black text-white italic tracking-tight uppercase">{data.label as string}</div>
    <div className="text-[10px] text-reminisce-text-muted mt-3 line-clamp-2 font-medium uppercase tracking-widest">{data.description as string}</div>
    <div className="mt-5 flex items-center justify-between">
      <span className={`text-[9px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-rem-pill border ${
        data.status === 'complete' ? 'bg-reminisce-accent-green/10 border-reminisce-accent-green/30 text-reminisce-accent-green' :
        data.status === 'active' ? 'bg-reminisce-accent-blue/10 border-reminisce-accent-blue/30 text-reminisce-accent-blue' :
        'bg-reminisce-bg-base border-reminisce-border-subtle text-reminisce-text-muted'
      }`}>
        {data.status as string}
      </span>
    </div>
  </div>
)

const FeatureNode = ({ data }: NodeProps) => (
  <div className="px-5 py-4 shadow-2xl rounded-rem-md bg-reminisce-bg-surface border border-reminisce-accent-purple min-w-[200px] group transition-all">
    <Handle type="target" position={Position.Top} className="w-2.5 h-2.5 bg-reminisce-accent-purple border-2 border-black" />
    <div className="flex items-center gap-3 mb-2">
      <Box className="w-4 h-4 text-reminisce-accent-purple" />
      <span className="text-[9px] font-black text-reminisce-accent-purple uppercase tracking-[0.3em]">Feature Module</span>
    </div>
    <div className="text-sm font-black text-white mb-4 italic tracking-tight uppercase">{data.label as string}</div>
    <div className="flex items-center justify-between gap-3">
      <div className="flex gap-1.5">
        <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-rem-pill border border-reminisce-border-default bg-black text-reminisce-text-muted">
          {data.featureType as string}
        </span>
      </div>
      <Button 
        size="icon" 
        className="w-8 h-8 bg-[var(--accent-primary)] hover:brightness-110 text-black rounded-rem-md shadow-lg shadow-[var(--accent-glow)] active-button-press"
        onClick={(e) => {
          e.stopPropagation();
          window.location.href = `/dashboard/projects/${data.projectId}/agent?featureId=${data.id}`;
        }}
      >
        <Play className="w-3.5 h-3.5 fill-current" />
      </Button>
    </div>
  </div>
)

// --- Layout Engine ---

const PROJECT_NODE_W = 280
const PROJECT_NODE_H = 100
const PHASE_NODE_W = 260
const PHASE_NODE_H = 130
const FEATURE_NODE_W = 220
const FEATURE_NODE_H = 110

function getLayoutedElements(
  nodes: Node[],
  edges: Edge[]
) {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({
    rankdir: 'TB',
    ranksep: 100,
    nodesep: 50,
    marginx: 60,
    marginy: 60,
  })

  nodes.forEach(node => {
    // Size based on node type
    const isProject = node.type === 'projectNode'
    const isPhase = node.type === 'phaseNode'
    g.setNode(node.id, {
      width: isProject 
        ? PROJECT_NODE_W 
        : isPhase 
        ? PHASE_NODE_W 
        : FEATURE_NODE_W,
      height: isProject 
        ? PROJECT_NODE_H 
        : isPhase 
        ? PHASE_NODE_H 
        : FEATURE_NODE_H,
    })
  })

  edges.forEach(edge => {
    g.setEdge(edge.source, edge.target)
  })

  dagre.layout(g)

  const layoutedNodes = nodes.map(node => {
    const nodeWithPosition = g.node(node.id)
    const isProject = node.type === 'projectNode'
    const isPhase = node.type === 'phaseNode'
    const w = isProject 
      ? PROJECT_NODE_W 
      : isPhase 
      ? PHASE_NODE_W 
      : FEATURE_NODE_W
    const h = isProject 
      ? PROJECT_NODE_H 
      : isPhase 
      ? PHASE_NODE_H 
      : FEATURE_NODE_H
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - w / 2,
        y: nodeWithPosition.y - h / 2,
      },
    }
  })

  return { nodes: layoutedNodes, edges }
}

// --- Graph Component ---

export default function GraphPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string
  const { accent } = useTheme()

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [loading, setLoading] = useState(true)
  const [project, setProject] = useState<{ name: string } | null>(null)
  const [isMobile, setIsMobile] = useState(false)

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedNodeData, setSelectedNodeData] = useState<{
    id: string
    type: 'phase' | 'feature'
    name: string
    description?: string
    status?: string
    featureId?: string
  } | null>(null)
  const [panelSaving, setPanelSaving] = useState(false)

  const STATUS_CONFIG: Record<string, { label: string, color: string }> = {
    todo:        { label: 'To Do',      color: '#6b7280' },
    in_progress: { label: 'In Progress', color: accent },
    blocked:     { label: 'Blocked',    color: '#ef4444' },
    done:        { label: 'Done',       color: '#10b981' },
    review:      { label: 'In Review',  color: '#8b5cf6' },
  }

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const nodeTypes = useMemo(() => ({
    projectNode: ProjectNode,
    phaseNode: PhaseNode,
    featureNode: FeatureNode
  }), [])

  const loadGraph = useCallback(async () => {
    try {
      const [
        { data: proj },
        { data: phases },
        { data: features },
        { data: savedNodes }
      ] = await Promise.all([
        supabase.from('projects').select('*').eq('id', projectId).single(),
        supabase.from('phases').select('*').eq('project_id', projectId).order('order_index'),
        supabase.from('features').select('id, name, description, status, type, phase_id').eq('project_id', projectId).order('priority'),
        supabase.from('graph_nodes').select('*').eq('project_id', projectId)
      ])

      setProject(proj)

      if (!phases || phases.length === 0) {
        setLoading(false)
        return
      }

      const rfNodes: Node[] = []
      const rfEdges: Edge[] = []

      const nodeMap = new Map()
      savedNodes?.forEach(n => {
        const key = n.metadata?.original_id || `${n.type}-${n.metadata?.phase_id || n.metadata?.feature_id || 'proj'}`
        nodeMap.set(key, n)
      })

      const projKey = `project-${projectId}`
      const savedProjNode = nodeMap.get(projKey)
      rfNodes.push({
        id: projKey,
        type: 'projectNode',
        position: savedProjNode ? { x: savedProjNode.position_x, y: savedProjNode.position_y } : { x: 400, y: 50 },
        data: { label: proj.name }
      })

      phases?.forEach((phase, index) => {
        const phaseKey = `phase-${phase.id}`
        const savedPhaseNode = nodeMap.get(phaseKey)
        const phaseX = index * 350
        const phasePos = savedPhaseNode ? { x: savedPhaseNode.position_x, y: savedPhaseNode.position_y } : { x: phaseX, y: 220 }
        
        rfNodes.push({
          id: phaseKey,
          type: 'phaseNode',
          position: phasePos,
          data: { label: phase.name, description: phase.description, status: phase.status || 'todo', id: phase.id, type: 'phase' }
        })

        rfEdges.push({
          id: `e-project-phase-${phase.id}`,
          source: projKey,
          target: phaseKey,
          animated: true,
          style: { stroke: '#3b82f6', strokeWidth: 2 }
        })

        const phaseFeatures = features?.filter(f => f.phase_id === phase.id)
        phaseFeatures?.forEach((feature, fIndex) => {
          const featureKey = `feature-${feature.id}`
          const savedFeatureNode = nodeMap.get(featureKey)
          const fPos = savedFeatureNode 
            ? { x: savedFeatureNode.position_x, y: savedFeatureNode.position_y } 
            : { x: phasePos.x + (fIndex % 2 === 0 ? -150 : 150), y: phasePos.y + 250 + (Math.floor(fIndex/2) * 150) }

          rfNodes.push({
            id: featureKey,
            type: 'featureNode',
            position: fPos,
            data: { 
              label: feature.name, 
              featureType: feature.type, 
              status: feature.status || 'todo', 
              description: feature.description, 
              id: feature.id, 
              featureId: feature.id,
              type: 'feature', 
              projectId: projectId 
            }
          })

          rfEdges.push({
            id: `e-phase-feature-${feature.id}`,
            source: phaseKey,
            target: featureKey,
            animated: true,
            style: { stroke: '#8b5cf6', strokeWidth: 2 }
          })
        })
      })

      const { nodes: layoutedNodes, edges: layoutedEdges } 
        = getLayoutedElements(rfNodes, rfEdges)
      setNodes(layoutedNodes)
      setEdges(layoutedEdges)
    } catch (err) {
      console.error(err)
      toast.error('Failed to load project graph')
    } finally {
      setLoading(false)
    }
  }, [projectId, setNodes, setEdges])

  useEffect(() => {
    loadGraph()
  }, [loadGraph])

  const onNodeDragStop = useCallback(async (_: React.MouseEvent, node: Node) => {
    try {
      const type = node.type?.slice(0, -4)
      const metadata: Record<string, string> = { original_id: node.id }
      
      if (node.id.startsWith('project-')) {
      } else if (node.id.startsWith('phase-')) {
        metadata.phase_id = node.id.replace('phase-', '')
      } else if (node.id.startsWith('feature-')) {
        metadata.feature_id = node.id.replace('feature-', '')
      }

      const { data: existing } = await supabase
        .from('graph_nodes')
        .select('id')
        .eq('project_id', projectId)
        .contains('metadata', { original_id: node.id })
        .maybeSingle()

      if (existing) {
        await supabase
          .from('graph_nodes')
          .update({ position_x: node.position.x, position_y: node.position.y })
          .eq('id', existing.id)
      } else {
        await supabase
          .from('graph_nodes')
          .insert({
            project_id: projectId,
            type: type,
            label: node.data.label as string,
            status: node.data.status as string || 'planned',
            position_x: node.position.x,
            position_y: node.position.y,
            metadata: metadata
          })
      }
    } catch (err) { console.error(err) }
  }, [projectId])

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.type === 'featureNode' || node.type === 'phaseNode') {
        setSelectedNodeId(node.id)
        setSelectedNodeData({
          id: node.id,
          type: node.type === 'phaseNode' ? 'phase' : 'feature',
          name: node.data.label as string,
          description: (node.data.description as string) || '',
          status: (node.data.status as string) || 'todo',
          featureId: (node.data.featureId as string) || node.id,
        })
      }
    },
    []
  )

  const handleSaveStatus = async (newStatus: string) => {
    if (!selectedNodeData) return
    setPanelSaving(true)
    try {
      const type = selectedNodeData.type
      const table = type === 'phase' ? 'phases' : 'features'
      // featureId is already the actual DB id
      const id = selectedNodeData.featureId || selectedNodeData.id.split('-').pop()
      
      const { error } = await supabase
        .from(table)
        .update({ status: newStatus })
        .eq('id', id)
      
      if (error) throw error

      // Update node data locally
      setNodes(nds => nds.map(n => 
        n.id === selectedNodeId
          ? { ...n, data: { ...n.data, status: newStatus } }
          : n
      ))
      setSelectedNodeData(prev => 
        prev ? { ...prev, status: newStatus } : null
      )
      toast.success('Status updated')
    } catch {
      toast.error('Failed to update status')
    } finally {
      setPanelSaving(false)
    }
  }

  const progressStats = useMemo(() => {
    const featureNodes = nodes.filter(
      n => n.type === 'featureNode'
    )
    const total = featureNodes.length
    const done = featureNodes.filter(
      n => n.data.status === 'done' || n.data.status === 'complete'
    ).length
    const inProgress = featureNodes.filter(
      n => n.data.status === 'in_progress' || n.data.status === 'active'
    ).length
    const blocked = featureNodes.filter(
      n => n.data.status === 'blocked'
    ).length
    return { 
      total, done, inProgress, blocked,
      pct: total > 0 ? Math.round((done / total) * 100) : 0 
    }
  }, [nodes])

  if (loading) return (
    <div className="flex-1 flex flex-col gap-6 p-6">
      <div className="h-10 w-64 animate-skeleton rounded-rem-md" />
      <div className="flex-1 animate-skeleton rounded-rem-lg border border-reminisce-border-subtle" />
    </div>
  )

  if (nodes.length === 0) return (
    <div className="flex-1 flex flex-col items-center justify-center p-20 text-center bg-black rounded-rem-lg border border-dashed border-reminisce-border-subtle animate-page-fade gap-8">
      <div className="w-24 h-24 bg-reminisce-accent-primary/5 rounded-rem-xl flex items-center justify-center border border-reminisce-accent-primary/10">
        <Network className="w-12 h-12 text-reminisce-accent-primary opacity-10" />
      </div>
      <div className="space-y-4 max-w-md">
        <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">Topology Void</h3>
        <p className="text-xs font-black uppercase tracking-widest text-reminisce-text-muted leading-relaxed italic opacity-60">Architectural map is currently offline. Deploy the Wizard to propagate technical nodes.</p>
        <Button onClick={() => window.location.href = `/dashboard/projects/${projectId}/wizard`} className="bg-[var(--accent-primary)] hover:brightness-110 text-black font-black h-14 px-10 rounded-rem-pill mt-4 active-button-press uppercase text-[10px] tracking-widest shadow-xl shadow-[var(--accent-glow)]">
          DEPLOY_WIZARD_DAEMON
        </Button>
      </div>
    </div>
  )

  const MobileListView = () => {
    const phases = nodes.filter(n => n.type === 'phaseNode')
    const features = nodes.filter(n => n.type === 'featureNode')
    return (
      <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-24">
        {phases.map(phase => (
          <div key={phase.id} className="bg-reminisce-bg-surface border border-reminisce-border-subtle rounded-rem-lg p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-reminisce-border-subtle pb-4">
              <div className="flex items-center gap-3"><Layers className="w-5 h-5 text-reminisce-accent-blue" /><h3 className="text-sm font-black text-white uppercase italic">{phase.data.label as string}</h3></div>
              <span className="text-[8px] font-black uppercase bg-reminisce-accent-blue/5 text-reminisce-accent-blue px-3 py-1 rounded-rem-pill border border-reminisce-accent-blue/20">{phase.data.status as string}</span>
            </div>
            <div className="grid gap-2">
              {features.filter((f: Node) => edges.some((e: Edge) => e.source === phase.id && e.target === f.id)).map((feature: Node) => (
                 <div key={feature.id} className="bg-black border border-reminisce-border-subtle rounded-rem-md p-4 flex items-center justify-between active-button-press" onClick={(e) => handleNodeClick(e, feature)}>
                    <div className="flex items-center gap-3"><Box className="w-4 h-4 text-reminisce-accent-purple" /><div><p className="text-xs font-black text-white uppercase italic">{feature.data.label as string}</p><p className="text-[8px] text-reminisce-text-muted font-black uppercase mt-1">{feature.data.featureType as string}</p></div></div>
                    <Terminal className="w-4 h-4 text-reminisce-text-muted" />
                 </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className={`flex-1 ${isMobile ? 'flex flex-col' : 'h-[calc(100vh-220px)]'} bg-black rounded-rem-lg border border-reminisce-border-subtle overflow-hidden flex relative shadow-2xl animate-page-fade`}>
      <title>{`Reminisce — Graph — ${project?.name}`}</title>
      {isMobile ? <MobileListView /> : (
        <div style={{ position: 'relative', flex: 1 }}>
          {/* Progress bar overlay */}
          <div style={{
            position: 'absolute',
            top: 16, left: 16,
            zIndex: 10,
            background: 'rgba(0,0,0,0.8)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12,
            padding: '12px 16px',
            minWidth: 220,
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 8,
            }}>
              <span style={{
                fontSize: 11, fontWeight: 600,
                color: 'rgba(255,255,255,0.5)',
              }}>
                Progress
              </span>
              <span style={{
                fontSize: 13, fontWeight: 700,
                color: accent,
              }}>
                {progressStats.pct}%
              </span>
            </div>
            {/* Progress bar track */}
            <div style={{
              height: 4,
              background: 'rgba(255,255,255,0.08)',
              borderRadius: 999,
              overflow: 'hidden',
              marginBottom: 10,
            }}>
              <div style={{
                height: '100%',
                width: `${progressStats.pct}%`,
                background: accent,
                borderRadius: 999,
                transition: 'width 0.4s ease',
              }} />
            </div>
            {/* Stats row */}
            <div style={{
              display: 'flex', gap: 12,
            }}>
              {[
                { label: 'Done', val: progressStats.done, 
                  color: '#10b981' },
                { label: 'Active', 
                  val: progressStats.inProgress, 
                  color: accent },
                { label: 'Blocked', 
                  val: progressStats.blocked, 
                  color: '#ef4444' },
                { label: 'Total', 
                  val: progressStats.total, 
                  color: 'rgba(255,255,255,0.3)' },
              ].map(s => (
                <div key={s.label} style={{ flex: 1 }}>
                  <div style={{
                    fontSize: 14, fontWeight: 700,
                    color: s.color,
                  }}>
                    {s.val}
                  </div>
                  <div style={{
                    fontSize: 9,
                    color: 'rgba(255,255,255,0.25)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    marginTop: 1,
                  }}>
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <ReactFlow 
            nodes={nodes} 
            edges={edges} 
            onNodesChange={onNodesChange} 
            onEdgesChange={onEdgesChange} 
            onNodeDragStop={onNodeDragStop} 
            onNodeClick={handleNodeClick} 
            nodeTypes={nodeTypes} 
            fitView 
            fitViewOptions={{ 
              padding: 0.15,
              includeHiddenNodes: false 
            }}
            minZoom={0.1}
            maxZoom={2}
            snapToGrid 
            snapGrid={[20, 20]} 
            colorMode="dark"
          >
            <Background variant={BackgroundVariant.Dots} gap={40} size={1} color="#1f1f1f" />
            <Controls showFitView={false} className="bg-reminisce-bg-surface border-reminisce-border-default text-white fill-white rounded-rem-md overflow-hidden" />
            <MiniMap className="bg-black/80 border border-reminisce-border-subtle rounded-rem-md overflow-hidden !m-4" nodeColor={(n) => n.type === 'projectNode' ? 'var(--accent-primary)' : n.type === 'phaseNode' ? '#3b82f6' : '#8b5cf6'} maskColor="rgba(0,0,0,0.8)" />
            <div className="absolute top-6 right-6 z-10"><Button size="sm" variant="outline" className="bg-reminisce-bg-surface/80 backdrop-blur-xl border-reminisce-border-default hover:bg-black text-[11px] font-medium text-white rounded-rem-pill px-6 text-transform-none h-10 shadow-2xl active-button-press"><Maximize className="w-3.5 h-3.5 mr-2" /> Recenter</Button></div>
          </ReactFlow>

          {/* Detail panel (right side overlay) */}
          {selectedNodeData && (
            <div style={{
              position: 'absolute',
              top: 0, right: 0, bottom: 0,
              width: 280,
              background: 'rgba(0,0,0,0.92)',
              backdropFilter: 'blur(20px)',
              borderLeft: '1px solid rgba(255,255,255,0.08)',
              zIndex: 20,
              display: 'flex',
              flexDirection: 'column',
              animation: 'slideInRight 0.2s ease',
            }}>
              {/* Panel header */}
              <div style={{
                padding: '16px 20px',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{
                    fontSize: 9, fontWeight: 700,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: 'rgba(255,255,255,0.3)',
                    marginBottom: 4,
                  }}>
                    {selectedNodeData.type === 'phase'
                      ? 'Phase' : 'Feature'}
                  </div>
                  <div style={{
                    fontSize: 14, fontWeight: 600,
                    color: '#fff',
                    lineHeight: 1.3,
                  }}>
                    {selectedNodeData.name}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedNodeId(null)
                    setSelectedNodeData(null)
                  }}
                  style={{
                    width: 28, height: 28,
                    border: 'none',
                    background: 'rgba(255,255,255,0.06)',
                    borderRadius: 6,
                    color: 'rgba(255,255,255,0.4)',
                    cursor: 'pointer', fontSize: 16,
                    display: 'flex', alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  ×
                </button>
              </div>

              {/* Panel body */}
              <div style={{
                flex: 1, overflowY: 'auto',
                padding: '16px 20px',
              }}>
                
                {/* Status selector */}
                {selectedNodeData.type === 'feature' && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{
                      fontSize: 10, fontWeight: 600,
                      letterSpacing: '0.06em',
                      color: 'rgba(255,255,255,0.35)',
                      textTransform: 'uppercase',
                      marginBottom: 8,
                    }}>
                      Status
                    </div>
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column', gap: 4,
                    }}>
                      {Object.entries(STATUS_CONFIG)
                        .map(([key, cfg]) => {
                        const isSelected = 
                          selectedNodeData.status === key
                        return (
                          <button
                            key={key}
                            onClick={() => 
                              handleSaveStatus(key)}
                            disabled={panelSaving}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              padding: '8px 12px',
                              borderRadius: 8,
                              border: `1px solid ${
                                isSelected 
                                  ? cfg.color + '50'
                                  : 'rgba(255,255,255,0.07)'
                              }`,
                              background: isSelected
                                ? cfg.color + '15'
                                : 'transparent',
                              color: isSelected
                                ? cfg.color : '#fff',
                              fontSize: 12,
                              fontWeight: isSelected ? 600 : 400,
                              cursor: 'pointer',
                              textAlign: 'left',
                              transition: 'all 0.12s',
                            }}
                          >
                            <div style={{
                              width: 8, height: 8,
                              borderRadius: '50%',
                              background: cfg.color,
                              flexShrink: 0,
                            }} />
                            {cfg.label}
                            {isSelected && (
                              <span style={{
                                marginLeft: 'auto',
                                fontSize: 12,
                              }}>
                                ✓
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Description */}
                {selectedNodeData.description && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{
                      fontSize: 10, fontWeight: 600,
                      letterSpacing: '0.06em',
                      color: 'rgba(255,255,255,0.35)',
                      textTransform: 'uppercase',
                      marginBottom: 8,
                    }}>
                      Description
                    </div>
                    <div style={{
                      fontSize: 12,
                      color: 'rgba(255,255,255,0.55)',
                      lineHeight: 1.65,
                    }}>
                      {selectedNodeData.description}
                    </div>
                  </div>
                )}
              </div>

              {/* Panel footer: Run Agent button */}
              {selectedNodeData.type === 'feature' && (
                <div style={{
                  padding: '14px 20px',
                  borderTop: '1px solid rgba(255,255,255,0.06)',
                }}>
                  <button
                    onClick={() => router.push(
                      `/dashboard/projects/${projectId}/agent?featureId=${selectedNodeData.featureId}`
                    )}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      padding: '10px',
                      background: accent,
                      color: '#000',
                      border: 'none',
                      borderRadius: 8,
                      fontSize: 12, fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    ▶ Run Agent
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
