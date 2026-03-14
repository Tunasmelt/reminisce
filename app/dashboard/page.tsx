'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Rocket, Plus, ChevronRight } from 'lucide-react'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthStore } from '@/store/auth'
import { toast } from 'sonner'

import { useRouter } from 'next/navigation'
import { useTheme } from '@/hooks/useTheme'
import CustomSelect from '@/components/CustomSelect'

interface ProjectStats {
  id: string
  phasesCount: number
  featuresCount: number
  lastRun: string | null
}

interface Workspace {
  id: string
  name: string
}

interface Project {
  id: string
  name: string
  description: string | null
  tech_stack: string[] | null
  workspace_id: string
  workspaces: {
    name: string
  }
}

function hexToRgba(hex: string, a: number) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

export default function DashboardPage() {
  const { user } = useAuthStore()
  const { accent } = useTheme()
  const router = useRouter()
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [projectStats, setProjectStats] = useState<Record<string, ProjectStats>>({})

  const [newWorkspaceName, setNewWorkspaceName] = useState('')
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false)
  const [isProjectOpen, setIsProjectOpen] = useState(false)

  const [projWS, setProjWS] = useState('')
  const [projName, setProjName] = useState('')
  const [projDesc, setProjDesc] = useState('')
  const [projUrl, setProjUrl] = useState('')
  const [projStack, setProjStack] = useState('')

  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const fetchData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    
    try {
      const { data: wsData } = await supabase.from('workspaces').select('*').order('created_at', { ascending: false })
      setWorkspaces(wsData || [])
      
      if (wsData && wsData.length > 0) {
        if (!projWS) setProjWS(wsData[0].id)
        const { data: projData } = await supabase.from('projects').select(`*, workspaces(name)`).order('created_at', { ascending: false })
        setProjects(projData as unknown as Project[])

        const stats: Record<string, ProjectStats> = {}
        for (const proj of (projData as unknown as Project[])) {
          const [ { count: pCount }, { count: fCount }, { data: lastRun } ] = await Promise.all([
            supabase.from('phases').select('*', { count: 'exact', head: true }).eq('project_id', proj.id),
            supabase.from('features').select('*', { count: 'exact', head: true }).eq('project_id', proj.id),
            supabase.from('agent_runs').select('created_at').eq('project_id', proj.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
          ])
          stats[proj.id] = { id: proj.id, phasesCount: pCount || 0, featuresCount: fCount || 0, lastRun: (lastRun as { created_at: string } | null)?.created_at || null }
        }
        setProjectStats(stats)
      }
    } catch { toast.error('Query failure') }
    finally { setLoading(false) }
  }, [user, projWS])

  useEffect(() => { fetchData() }, [fetchData])

  const handleCreateWorkspace = async () => {
    if (!newWorkspaceName.trim()) return
    const { error } = await supabase.from('workspaces').insert({ name: newWorkspaceName, owner_id: user?.id })
    if (error) toast.error(error.message)
    else { toast.success('Cluster registered'); setNewWorkspaceName(''); setIsWorkspaceOpen(false); fetchData() }
  }

  const handleCreateProject = async () => {
    if (!projWS || !projName.trim()) return toast.error('Metadata incomplete')
    const stackArray = projStack.split(',').map(s => s.trim()).filter(Boolean)
    const { error } = await supabase.from('projects').insert({ workspace_id: projWS, name: projName, description: projDesc, repo_url: projUrl, tech_stack: stackArray })
    if (error) toast.error(error.message)
    else { toast.success('Mission initialized'); setProjName(''); setProjDesc(''); setProjUrl(''); setProjStack(''); setIsProjectOpen(false); fetchData() }
  }

  const [selectedWS, setSelectedWS] = useState<string | 'all'>('all')
  const filteredProjects = selectedWS === 'all' ? projects : projects.filter(p => p.workspace_id === selectedWS)

  if (loading) {
    return (
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: isMobile ? '32px 20px' : '48px 32px' }} className="page-enter">
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', gap: 32 }}>
          <div style={{ flex: 1 }}>
            <div style={{ width: 120, height: 12, background: 'rgba(255,255,255,0.05)', borderRadius: 4, marginBottom: 16, animation: 'skeletonPulse 1.5s ease infinite' }} />
            <div style={{ width: '60%', height: 48, background: 'rgba(255,255,255,0.05)', borderRadius: 8, animation: 'skeletonPulse 1.5s ease infinite', animationDelay: '0.1s' }} />
          </div>
          <div style={{ width: isMobile ? '100%' : 220, height: 48, background: 'rgba(255,255,255,0.05)', borderRadius: 999, animation: 'skeletonPulse 1.5s ease infinite', animationDelay: '0.2s' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16, marginTop: 64 }}>
          {Array(3).fill(null).map((_, i) => (
            <div key={i} style={{
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 12,
              padding: 28,
              background: 'rgba(255,255,255,0.02)',
              minHeight: 200,
            }}>
              {[40, 60, 24, 80, 32].map((w, j) => (
                <div key={j} style={{
                  height: j === 2 ? 32 : 12,
                  width: `${w}%`,
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: 4,
                  marginBottom: j === 2 ? 24 : 12,
                  animation: 'skeletonPulse 1.5s ease infinite',
                  animationDelay: `${j * 0.1}s`,
                }} />
              ))}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: isMobile ? '32px 20px' : '48px 32px' }} className="page-enter">
      <title>Reminisce — Command Center</title>

      {/* HERO SECTION */}
      <section style={{ 
        display: 'flex', 
        flexDirection: isMobile ? 'column' : 'row',
        justifyContent: 'space-between', 
        alignItems: isMobile ? 'flex-start' : 'flex-end', 
        marginBottom: 64,
        gap: isMobile ? 32 : 0
      }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: '0.05em', color: 'rgba(255,255,255,0.25)', marginBottom: 12, textTransform: 'uppercase' }}>
            Your workspace
          </div>
          <h1 style={{ fontSize: isMobile ? 40 : 'clamp(40px, 5vw, 64px)', fontWeight: 800, letterSpacing: '-0.02em', color: '#fff', lineHeight: 1, margin: 0 }}>
            Projects
          </h1>
          <div style={{ fontSize: 13, letterSpacing: '0.02em', color: 'rgba(255,255,255,0.3)', marginTop: 12 }}>
            AI-powered context for every project.
          </div>
        </div>
        <button 
          onClick={() => setIsProjectOpen(true)}
          disabled={workspaces.length === 0}
          style={{
            border: '1px solid rgba(255,255,255,0.15)',
            background: accent,
            borderRadius: 999,
            padding: '12px 24px',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.02em',
            color: '#000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            cursor: 'pointer',
            transition: 'all 0.2s',
            width: isMobile ? '100%' : 'auto'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '0.88'
            e.currentTarget.style.transform = 'scale(1.02)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '1'
            e.currentTarget.style.transform = 'scale(1)'
          }}
        >
          <Rocket size={14} /> New project
        </button>
      </section>

      {/* CLUSTER FILTER TABS */}
      <div style={{ 
        display: 'flex', 
        gap: 0, 
        borderBottom: '1px solid rgba(255,255,255,0.06)', 
        marginBottom: 32,
        overflowX: 'auto'
      }} className="hide-scrollbar">
        <button
          onClick={() => setSelectedWS('all')}
          style={{
            padding: '10px 20px',
            fontSize: 12,
            fontWeight: 500,
            letterSpacing: 'normal',
            cursor: 'pointer',
            border: 'none',
            background: 'transparent',
            borderBottom: selectedWS === 'all' ? `2px solid ${accent}` : '2px solid transparent',
            color: selectedWS === 'all' ? accent : 'rgba(255,255,255,0.3)',
            marginBottom: -1,
            transition: 'all 0.2s',
            minWidth: 'max-content'
          }}
        >
          All
        </button>
        {workspaces.map(w => (
          <button
            key={w.id}
            onClick={() => setSelectedWS(w.id)}
            style={{
              padding: '10px 20px',
              fontSize: 12,
              fontWeight: 500,
              letterSpacing: 'normal',
              cursor: 'pointer',
              border: 'none',
              background: 'transparent',
              borderBottom: selectedWS === w.id ? `2px solid ${accent}` : '2px solid transparent',
              color: selectedWS === w.id ? accent : 'rgba(255,255,255,0.3)',
              marginBottom: -1,
              transition: 'all 0.2s',
              minWidth: 'max-content'
            }}
          >
            {w.name}
          </button>
        ))}
      </div>

      {/* PROJECTS GRID */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(320px, 1fr))', 
        gap: 16 
      }}>
        {filteredProjects.map((p) => {
          const stats = projectStats[p.id]
          return (
            <div 
              key={p.id}
              onClick={() => router.push(`/dashboard/projects/${p.id}`)}
              style={{
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 12,
                background: 'rgba(255,255,255,0.02)',
                padding: 28,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                position: 'relative',
                overflow: 'hidden'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = hexToRgba(accent, 0.3)
                e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                e.currentTarget.style.transform = 'translateY(-2px)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
                e.currentTarget.style.background = 'rgba(255,255,255,0.02)'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{
                  fontSize: 10,
                  fontWeight: 500,
                  letterSpacing: 'normal',
                  padding: '4px 10px',
                  borderRadius: 999,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'rgba(255,255,255,0.5)'
                }}>
                  {p.workspaces?.name || 'General'}
                </div>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: accent }} />
              </div>

              <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em', color: '#fff', marginTop: 16, marginBottom: 4 }}>
                {p.name}
              </h2>
              <div style={{ fontSize: 13, fontWeight: 400, color: 'rgba(255,255,255,0.4)', marginBottom: 24 }}>
                {p.description ? (p.description.length > 60 ? p.description.slice(0, 60) + '...' : p.description) : 'No description'}
              </div>

              <div style={{ display: 'flex', gap: 32 }}>
                <div>
                  <span style={{ fontSize: 24, fontWeight: 900, color: '#fff' }}>{stats?.phasesCount || 0}</span>
                  <span style={{ fontSize: 11, fontWeight: 400, color: 'rgba(255,255,255,0.3)', display: 'block', marginTop: 2 }}>Phases</span>
                </div>
                <div>
                  <span style={{ fontSize: 24, fontWeight: 900, color: '#fff' }}>{stats?.featuresCount || 0}</span>
                  <span style={{ fontSize: 11, fontWeight: 400, color: 'rgba(255,255,255,0.3)', display: 'block', marginTop: 2 }}>Features</span>
                </div>
              </div>

              {stats?.lastRun && (
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', marginTop: 8 }}>
                  Last run {new Date(stats.lastRun).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                </div>
              )}

              <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/projects/${p.id}`) }}
                  style={{
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: 999,
                    padding: '8px 16px',
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: 'normal',
                    color: 'rgba(255,255,255,0.7)',
                    background: 'transparent',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = accent
                    e.currentTarget.style.color = accent
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'
                    e.currentTarget.style.color = 'rgba(255,255,255,0.7)'
                  }}
                >
                  Open
                </button>
                <ChevronRight size={14} style={{ color: 'rgba(255,255,255,0.2)' }} />
              </div>
            </div>
          )
        })}

        <div
          onClick={() => setIsProjectOpen(true)}
          style={{
            border: '1px dashed rgba(255,255,255,0.08)',
            borderRadius: 12,
            background: 'transparent',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            minHeight: 200,
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = hexToRgba(accent, 0.3)
            e.currentTarget.style.background = hexToRgba(accent, 0.03)
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
            e.currentTarget.style.background = 'transparent'
          }}
        >
          <Plus size={32} style={{ color: 'rgba(255,255,255,0.15)' }} />
          <div style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.25)' }}>
            New project
          </div>
        </div>
      </div>

      {/* CLUSTER TOPOGRAPHY SECTION */}
      <section style={{ marginTop: 80, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 48 }}>
        <div style={{ fontSize: 10, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: 16 }}>
          CLUSTER TOPOGRAPHY
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {workspaces.map(w => (
            <div 
              key={w.id}
              style={{
                padding: '8px 20px',
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.03)',
                color: 'rgba(255,255,255,0.5)',
                transition: 'all 0.2s',
                cursor: 'default'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = hexToRgba(accent, 0.3)
                e.currentTarget.style.color = accent
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
                e.currentTarget.style.color = 'rgba(255,255,255,0.5)'
              }}
            >
              {w.name}
            </div>
          ))}
          <button 
            onClick={() => setIsWorkspaceOpen(true)}
            style={{
              padding: '8px 20px',
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              border: '1px dashed rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.03)',
              color: 'rgba(255,255,255,0.2)',
              transition: 'all 0.2s',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = hexToRgba(accent, 0.3)
              e.currentTarget.style.color = accent
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
              e.currentTarget.style.color = 'rgba(255,255,255,0.2)'
            }}
          >
            + NEW_CLUSTER
          </button>
        </div>
      </section>

      {/* Dialogs */}
      <Dialog open={isProjectOpen} onOpenChange={setIsProjectOpen}>
        <DialogContent style={{ background: '#000', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 16 }}>
          <DialogHeader><DialogTitle style={{ color: '#fff', fontWeight: 700 }}>New project</DialogTitle></DialogHeader>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '20px 0' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Workspace</Label>
              <CustomSelect
                value={projWS}
                onChange={setProjWS}
                options={workspaces.map(w => ({
                  value: w.id,
                  label: w.name,
                }))}
                width="100%"
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Project name</Label>
              <Input value={projName} onChange={e => setProjName(e.target.value)} style={{ height: 44, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', outline: 'none' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Stack</Label>
              <Input value={projStack} onChange={e => setProjStack(e.target.value)} placeholder="React, Node, etc" style={{ height: 44, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', outline: 'none' }} />
            </div>
          </div>
          <DialogFooter>
            <button 
              onClick={handleCreateProject}
              style={{
                width: '100%',
                height: 48,
                background: accent,
                color: '#000',
                fontWeight: 700,
                borderRadius: 999,
                border: 'none',
                cursor: 'pointer',
                fontSize: 13
              }}
            >
              Create
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isWorkspaceOpen} onOpenChange={setIsWorkspaceOpen}>
        <DialogContent style={{ background: '#000', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 16 }}>
          <DialogHeader><DialogTitle style={{ color: '#fff', fontWeight: 700 }}>New workspace</DialogTitle></DialogHeader>
          <div style={{ padding: '20px 0' }}>
            <Label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 8, display: 'block' }}>Workspace name</Label>
            <Input 
              value={newWorkspaceName} 
              onChange={e => setNewWorkspaceName(e.target.value)} 
              placeholder="e.g. Personal" 
              style={{ height: 44, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', outline: 'none' }}
            />
          </div>
          <DialogFooter>
            <button 
              onClick={handleCreateWorkspace}
              style={{
                width: '100%',
                height: 48,
                background: accent,
                color: '#000',
                fontWeight: 700,
                borderRadius: 999,
                border: 'none',
                cursor: 'pointer',
                fontSize: 13
              }}
            >
              Create
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
