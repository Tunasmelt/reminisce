'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Rocket, Plus } from 'lucide-react'
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
  const [searchQuery, setSearchQuery] = useState('')
  const [userPlan, setUserPlan] = useState<{ plan: string, projects_limit: number } | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [wallet, setWallet] = useState<{ gems: number, coins: number } | null>(null)

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

      const { data: planData } = await supabase
        .from('user_plans')
        .select('plan, projects_limit')
        .eq('user_id', user.id)
        .single()
      
      if (planData) setUserPlan(planData)

      const { data: walletData } = await supabase
        .from('user_wallets')
        .select('gems, coins')
        .eq('user_id', user.id)
        .single()
      
      if (walletData) setWallet(walletData)

      // Handle Stripe redirect success params
      const params = new URLSearchParams(window.location.search)
      const upgraded = params.get('upgraded')
      const gemsPurchased = params.get('gems_purchased')
      
      if (upgraded === 'true') {
        toast.success(
          '🎉 Welcome to Pro! Your 100 gems have been granted.',
          { duration: 6000 }
        )
        // Clean URL
        window.history.replaceState({}, '', '/dashboard')
        // Refresh wallet + plan display
        setWallet(prev => prev 
          ? { ...prev, gems: (prev.gems || 0) + 100 }
          : prev
        )
        setUserPlan({ plan: 'pro', projects_limit: 999 })
      }
      
      if (gemsPurchased) {
        toast.success(
          `💎 ${gemsPurchased} gems added to your wallet!`,
          { duration: 6000 }
        )
        window.history.replaceState({}, '', '/dashboard')
        setWallet(prev => prev
          ? { ...prev, 
              gems: (prev.gems || 0) + 
                    parseInt(gemsPurchased) }
          : prev
        )
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
  const filteredProjects = (selectedWS === 'all' 
    ? projects 
    : projects.filter(p => p.workspace_id === selectedWS)
  ).filter(p => 
    !searchQuery || 
    p.name.toLowerCase().includes(
      searchQuery.toLowerCase()
    )
  )

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

        {userPlan && userPlan.plan === 'free' && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: 8,
          }}>
            <div style={{
              width: 200,
              height: 4,
              background: 'rgba(255,255,255,0.07)',
              borderRadius: 999,
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${Math.min(
                  (projects.length / userPlan.projects_limit) 
                  * 100, 100
                )}%`,
                background: projects.length >= 
                  userPlan.projects_limit
                    ? '#ef4444'
                    : accent,
                borderRadius: 999,
                transition: 'width 0.3s ease',
              }} />
            </div>
            <span style={{
              fontSize: 11,
              color: 'rgba(255,255,255,0.35)',
            }}>
              {projects.length}/{userPlan.projects_limit} projects
              {projects.length >= userPlan.projects_limit && (
                <span style={{ color: '#ef4444' }}>
                  {' '}· limit reached
                </span>
              )}
            </span>
          </div>
        )}

        {(() => {
          const atLimit = userPlan 
            && projects.length >= userPlan.projects_limit
          return (
            <button
              onClick={() => {
                if (atLimit) {
                  toast.error(
                    `Free tier allows ${userPlan?.projects_limit} projects. Upgrade to Pro for unlimited.`,
                    { duration: 5000 }
                  )
                  return
                }
                setIsProjectOpen(true)
              }}
              disabled={workspaces.length === 0}
              style={{
                display: 'flex',
                alignItems: 'center', gap: 8,
                padding: '12px 24px',
                background: atLimit 
                  ? 'rgba(255,255,255,0.08)' 
                  : accent,
                color: atLimit ? 'rgba(255,255,255,0.4)' : '#000',
                border: atLimit 
                  ? '1px solid rgba(255,255,255,0.1)' 
                  : '1px solid rgba(255,255,255,0.15)',
                borderRadius: 999,
                fontSize: 12, fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s',
                width: isMobile ? '100%' : 'auto'
              }}
              onMouseEnter={(e) => {
                if (!atLimit) {
                  e.currentTarget.style.opacity = '0.88'
                  e.currentTarget.style.transform = 'scale(1.02)'
                }
              }}
              onMouseLeave={(e) => {
                if (!atLimit) {
                  e.currentTarget.style.opacity = '1'
                  e.currentTarget.style.transform = 'scale(1)'
                }
              }}
            >
              {atLimit 
                ? `⚡ Upgrade for more projects`
                : <><Rocket size={14} /> New project</>
              }
            </button>
          )
        })()}
      </section>

      {/* SEARCH BAR */}
      <div style={{
        marginBottom: 20,
        position: 'relative',
      }}>
        <input
          type="text"
          placeholder="Search projects..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 10,
            padding: '10px 16px 10px 40px',
            fontSize: 13, color: '#fff',
            outline: 'none', fontFamily: 'inherit',
            boxSizing: 'border-box',
          }}
          onFocus={e => {
            e.currentTarget.style.borderColor = accent
          }}
          onBlur={e => {
            e.currentTarget.style.borderColor =
              'rgba(255,255,255,0.08)'
          }}
        />
        <span style={{
          position: 'absolute',
          left: 14, top: '50%',
          transform: 'translateY(-50%)',
          color: 'rgba(255,255,255,0.3)',
          fontSize: 14,
        }}>⌕</span>
      </div>

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
              {/* Top row: workspace badge + active dot */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 14,
              }}>
                <span style={{
                  fontSize: 9, fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: 999,
                  background: hexToRgba(accent, 0.1),
                  border: `1px solid ${hexToRgba(accent, 0.2)}`,
                  color: accent,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}>
                  {p.workspaces?.name || 'General'}
                </span>
                <span style={{
                  display: 'flex', alignItems: 'center',
                  gap: 5, fontSize: 10, fontWeight: 600,
                  color: '#10b981',
                }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: '#10b981',
                    animation: 'agentPulse 2s infinite',
                    display: 'inline-block',
                  }} />
                  Active
                </span>
              </div>

              {/* Project name */}
              <h2 style={{
                fontSize: 20, fontWeight: 700,
                letterSpacing: '-0.01em', color: '#fff',
                margin: '0 0 4px',
              }}>
                {p.name}
              </h2>
              <div style={{
                fontSize: 12,
                color: 'rgba(255,255,255,0.35)',
                marginBottom: 16,
              }}>
                {p.description || 'No description'}
              </div>

              {/* Progress bar */}
              {stats && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: 6,
                  }}>
                    <span style={{
                      fontSize: 9, fontWeight: 700,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      color: 'rgba(255,255,255,0.3)',
                    }}>
                      Progress
                    </span>
                    <span style={{
                      fontSize: 9, fontWeight: 700,
                      color: accent,
                    }}>
                      {stats.featuresCount > 0
                        ? '0%'
                        : '—'}
                    </span>
                  </div>
                  <div style={{
                    height: 3,
                    background: 'rgba(255,255,255,0.07)',
                    borderRadius: 999,
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%',
                      width: '24%',
                      background: accent,
                      borderRadius: 999,
                    }} />
                  </div>
                </div>
              )}

              {/* Stats row */}
              <div style={{
                display: 'flex',
                gap: 16,
                marginBottom: 16,
              }}>
                <span style={{
                  fontSize: 12,
                  color: 'rgba(255,255,255,0.45)',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}>
                  <span style={{ fontSize: 13 }}>⊕</span>
                  {stats?.phasesCount || 0} phases
                </span>
                <span style={{
                  fontSize: 12,
                  color: 'rgba(255,255,255,0.45)',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}>
                  <span style={{ fontSize: 13 }}>↗</span>
                  {stats?.featuresCount || 0} features
                </span>
                {stats?.lastRun && (
                  <span style={{
                    fontSize: 11,
                    color: 'rgba(255,255,255,0.25)',
                    display: 'flex', alignItems: 'center',
                    gap: 4, marginLeft: 'auto',
                  }}>
                    ◷ {new Date(stats.lastRun)
                      .toLocaleDateString([], {
                        month: 'short', day: 'numeric'
                      })}
                  </span>
                )}
              </div>

              {/* Open button */}
              <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
              }}>
                <button
                  onClick={e => {
                    e.stopPropagation()
                    router.push(`/dashboard/projects/${p.id}`)
                  }}
                  style={{
                    display: 'flex', alignItems: 'center',
                    gap: 5, fontSize: 12, fontWeight: 600,
                    color: 'rgba(255,255,255,0.5)',
                    background: 'transparent', border: 'none',
                    cursor: 'pointer',
                    transition: 'color 0.15s',
                  }}
                  onMouseEnter={e =>
                    e.currentTarget.style.color = accent
                  }
                  onMouseLeave={e =>
                    e.currentTarget.style.color =
                      'rgba(255,255,255,0.5)'
                  }
                >
                  Open →
                </button>
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
      </div>       {workspaces.length > 0 && (
        <div style={{
          marginTop: 48,
          padding: '20px 24px',
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 12,
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8, marginBottom: 14,
          }}>
            <span style={{ fontSize: 14 }}>⊞</span>
            <span style={{
              fontSize: 9, fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.3)',
            }}>
              Cluster Topography
            </span>
          </div>
          <div style={{
            display: 'flex', gap: 8,
            flexWrap: 'wrap',
          }}>
            {workspaces.map(w => (
              <button
                key={w.id}
                onClick={() => setSelectedWS(w.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center', gap: 6,
                  padding: '6px 14px',
                  borderRadius: 999,
                  border: `1px solid ${
                    selectedWS === w.id
                      ? accent
                      : 'rgba(255,255,255,0.15)'
                  }`,
                  background: selectedWS === w.id
                    ? hexToRgba(accent, 0.1)
                    : 'rgba(255,255,255,0.04)',
                  color: selectedWS === w.id
                    ? accent
                    : 'rgba(255,255,255,0.6)',
                  fontSize: 11, fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {w.name}
                <span style={{
                  fontSize: 9,
                  background: selectedWS === w.id
                    ? hexToRgba(accent, 0.2)
                    : 'rgba(255,255,255,0.1)',
                  borderRadius: 999,
                  padding: '1px 6px',
                  color: selectedWS === w.id
                    ? accent
                    : 'rgba(255,255,255,0.4)',
                }}>
                  {projects.filter(
                    p => p.workspace_id === w.id
                  ).length}
                </span>
              </button>
            ))}
            <button
              onClick={() => setIsWorkspaceOpen(true)}
              style={{
                padding: '6px 14px',
                borderRadius: 999,
                border: '1px dashed rgba(255,255,255,0.12)',
                background: 'transparent',
                color: 'rgba(255,255,255,0.3)',
                fontSize: 11, fontWeight: 600,
                letterSpacing: '0.06em',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = accent
                e.currentTarget.style.color = accent
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor =
                  'rgba(255,255,255,0.12)'
                e.currentTarget.style.color =
                  'rgba(255,255,255,0.3)'
              }}
            >
              + New Cluster
            </button>
          </div>
        </div>
      )}

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
