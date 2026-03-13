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

import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { 
  Maximize, 
  Play, 
  Settings2, 
  X,
  Target,
  Box,
  Layers,
  Network,
  Terminal,
  ChevronDown
} from 'lucide-react'

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

// --- Graph Component ---

export default function GraphPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [loading, setLoading] = useState(true)
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [project, setProject] = useState<{ name: string } | null>(null)
  const [isMobile, setIsMobile] = useState(false)

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
        supabase.from('features').select('*').eq('project_id', projectId).order('priority'),
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
          data: { label: phase.name, description: phase.description, status: phase.status, id: phase.id, type: 'phase' }
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
            data: { label: feature.name, featureType: feature.type, status: feature.status, description: feature.description, id: feature.id, type: 'feature', projectId: projectId }
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

      setNodes(rfNodes)
      setEdges(rfEdges)
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

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (node.type === 'projectNode') return 
    setSelectedNode(node)
  }, [])

  const handleStatusChange = async (newStatus: string) => {
    if (!selectedNode) return
    const id = selectedNode.data.id as string
    const type = selectedNode.data.type as string

    try {
      const table = type === 'phase' ? 'phases' : 'features'
      const { error } = await supabase.from(table).update({ status: newStatus }).eq('id', id)
      if (error) throw error
      toast.success(`${type} updated`)
      setNodes((nds) => nds.map((n) => n.id === selectedNode.id ? { ...n, data: { ...n.data, status: newStatus } } : n))
      setSelectedNode(prev => prev ? { ...prev, data: { ...prev.data, status: newStatus } } : null)
    } catch { toast.error('Update failed') }
  }

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
                 <div key={feature.id} className="bg-black border border-reminisce-border-subtle rounded-rem-md p-4 flex items-center justify-between active-button-press" onClick={() => setSelectedNode(feature)}>
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
        <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onNodeDragStop={onNodeDragStop} onNodeClick={onNodeClick} nodeTypes={nodeTypes} fitView snapToGrid snapGrid={[20, 20]} colorMode="dark">
          <Background variant={BackgroundVariant.Dots} gap={40} size={1} color="#1f1f1f" />
          <Controls showFitView={false} className="bg-reminisce-bg-surface border-reminisce-border-default text-white fill-white rounded-rem-md overflow-hidden" />
          <MiniMap className="bg-black/80 border border-reminisce-border-subtle rounded-rem-md overflow-hidden !m-4" nodeColor={(n) => n.type === 'projectNode' ? 'var(--accent-primary)' : n.type === 'phaseNode' ? '#3b82f6' : '#8b5cf6'} maskColor="rgba(0,0,0,0.8)" />
          <div className="absolute top-6 right-6 z-10"><Button size="sm" variant="outline" className="bg-reminisce-bg-surface/80 backdrop-blur-xl border-reminisce-border-default hover:bg-black text-[10px] font-black text-white rounded-rem-pill px-6 uppercase h-10 shadow-2xl active-button-press"><Maximize className="w-3.5 h-3.5 mr-2" /> RECENTER_TOPOLOGY</Button></div>
        </ReactFlow>
      )}

      {selectedNode && (
        <div className={`absolute ${isMobile ? 'inset-0' : 'top-6 right-6 bottom-6 w-96'} bg-reminisce-bg-surface/95 border border-reminisce-border-subtle backdrop-blur-2xl rounded-rem-lg shadow-2xl z-50 flex flex-col animate-in ${isMobile ? 'slide-in-from-bottom-10' : 'slide-in-from-right-10'} duration-500`}>
          <div className="p-6 md:p-8 border-b border-reminisce-border-subtle flex items-center justify-between bg-black/40">
            <div className="flex items-center gap-3"><Settings2 className="w-4 h-4 text-[var(--accent-primary)]" /><h3 className="text-[10px] font-black text-white uppercase tracking-widest">Node Inspector</h3></div>
            <Button size="icon" variant="ghost" className="h-8 w-8 text-reminisce-text-muted hover:text-white" onClick={() => setSelectedNode(null)}><X className="w-4 h-4" /></Button>
          </div>
          <div className="flex-1 overflow-y-auto p-8 pb-24 scrollbar-thin scrollbar-thumb-reminisce-border-subtle">
            <div className={`text-[9px] font-black uppercase tracking-[0.4em] mb-4 flex items-center gap-2.5 ${selectedNode.type === 'phaseNode' ? 'text-reminisce-accent-blue' : 'text-reminisce-accent-purple'}`}>{selectedNode.type === 'phaseNode' ? <Layers className="w-4 h-4" /> : <Box className="w-4 h-4" />}{selectedNode.type === 'phaseNode' ? 'Architectural Phase' : 'Project Feature'}</div>
            <h2 className="text-3xl font-black text-white mb-4 italic uppercase tracking-tighter">{selectedNode.data.label as string}</h2>
            <div className="space-y-10 mt-10">
              <div><label className="text-[9px] font-black text-reminisce-text-muted uppercase tracking-widest block mb-4">SPECIFICATION</label><p className="text-sm text-reminisce-text-secondary leading-relaxed bg-black/40 p-6 rounded-rem-md border border-reminisce-border-subtle font-medium italic">{selectedNode.data.description as string || 'No documentation found.'}</p></div>
              <div><label className="text-[9px] font-black text-reminisce-text-muted uppercase tracking-widest block mb-4">ORCHESTRATION_STATUS</label><div className="relative"><select className="w-full appearance-none bg-black border border-reminisce-border-default rounded-rem-md px-4 py-3.5 text-[10px] font-black text-white uppercase tracking-widest outline-none hover:border-[var(--accent-primary)] transition-all cursor-pointer" value={selectedNode.data.status as string} onChange={(e) => handleStatusChange(e.target.value)}><option value="planned">PLANNED</option><option value="active">ACTIVE</option><option value="complete">COMPLETE</option></select><ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--accent-primary)] pointer-events-none" /></div></div>
              {selectedNode.type === 'featureNode' && (
                <div className="bg-[var(--accent-subtle)] border border-[var(--accent-primary)]/20 p-8 rounded-rem-lg mt-10"><div className="flex items-center gap-3 mb-4"><Terminal className="w-5 h-5 text-[var(--accent-primary)]" /><span className="text-[10px] font-black text-[var(--accent-primary)] uppercase">Agent Control</span></div><Button className="w-full h-14 bg-[var(--accent-primary)] hover:brightness-110 text-black font-black uppercase tracking-widest text-[11px] rounded-rem-pill active-button-press" onClick={() => router.push(`/dashboard/projects/${projectId}/agent?featureId=${selectedNode.data.id}`)}><Play className="w-4 h-4 mr-3" /> RUN MODULE AGENT</Button></div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
