'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Rocket, Plus, FolderOpen, CheckCircle2 } from 'lucide-react'
import { saveHandle } from '@/lib/fsapi'
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
  const [wallet, setWallet] = useState<{ gems: number, coins: number } | null>(null)

  const [newWorkspaceName, setNewWorkspaceName] = useState('')
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false)
  const [isProjectOpen, setIsProjectOpen] = useState(false)

  const [confirmDelete, setConfirmDelete] = useState<{
    id: string
    name: string
  } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const [projWS, setProjWS] = useState('')
  const [projName, setProjName] = useState('')
  const [projDesc, setProjDesc] = useState('')
  const [projUrl, setProjUrl] = useState('')
  const [modalDirHandle, setModalDirHandle] = useState<FileSystemDirectoryHandle | null>(null)
  const [modalFolderName, setModalFolderName] = useState<string | null>(null)
  const [isFsSupported, setIsFsSupported] = useState(false)

  const [isMobile, setIsMobile] = useState(false)
  const [dismissedOnboarding, setDismissedOnboarding] = useState(() => {
    if (typeof window === 'undefined') return true
    return localStorage.getItem('reminisce_onboarding_dismissed') === '1'
  })
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    setIsFsSupported(typeof window !== 'undefined' && 'showDirectoryPicker' in window)
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
          const [{ count: pCount }, { count: fCount }, { data: lastRun }] = await Promise.all([
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
          ? {
            ...prev,
            gems: (prev.gems || 0) +
              parseInt(gemsPurchased)
          }
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
    else { toast.success('Group created'); setNewWorkspaceName(''); setIsWorkspaceOpen(false); fetchData() }
  }

  const handleDeleteWorkspace = (workspaceId: string, workspaceName: string) => {
    const projectCount = projects.filter(p => p.workspace_id === workspaceId).length
    if (projectCount > 0) {
      toast.error(`Cannot delete "${workspaceName}" — move or delete its ${projectCount} project${projectCount > 1 ? 's' : ''} first`)
      return
    }
    setConfirmDelete({ id: workspaceId, name: workspaceName })
  }

  const handleConfirmDeleteWorkspace = async () => {
    if (!confirmDelete) return
    setIsDeleting(true)
    const { error } = await supabase
      .from('workspaces')
      .delete()
      .eq('id', confirmDelete.id)
    setIsDeleting(false)
    setConfirmDelete(null)
    if (error) toast.error(error.message)
    else { toast.success(`Group "${confirmDelete.name}" deleted`); fetchData() }
  }

  const handlePickFolderInModal = async () => {
    if (!isFsSupported) return
    try {
      const h = await (window as unknown as {
        showDirectoryPicker: (o: object) => Promise<FileSystemDirectoryHandle>
      }).showDirectoryPicker({ mode: 'readwrite' })
      setModalDirHandle(h)
      setModalFolderName(h.name)
    } catch { /* user dismissed */ }
  }

  const handleCreateProject = async () => {
    if (!projWS || !projName.trim()) return toast.error('Metadata incomplete')
    const stackArray: string[] = []
    const { data: { session: authSession } } = await supabase.auth.getSession()
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authSession?.access_token}`
      },
      body: JSON.stringify({
        workspaceId: projWS,
        name: projName,
        description: projDesc,
        repoUrl: projUrl,
        techStack: stackArray
      })
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      return toast.error(body?.error || 'Failed to create project')
    }
    const { project: inserted } = await res.json()
    if (modalDirHandle && inserted?.id) {
      try { await saveHandle(inserted.id, modalDirHandle) } catch { /* non-fatal */ }
    }
    toast.success('Project created')
    setProjName(''); setProjDesc(''); setProjUrl('')
    setModalDirHandle(null); setModalFolderName(null)
    setIsProjectOpen(false)
    // Navigate to the new project overview directly
    if (inserted?.id) {
      router.push(`/dashboard/projects/${inserted.id}`)
    } else {
      fetchData()
    }
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
      <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, rgba(var(--accent-rgb),0.03) 0%, transparent 40%)', position: 'relative' }}>
        <div style={{ maxWidth: 1240, margin: '0 auto', padding: isMobile ? '32px 20px' : '52px 40px' }} className="page-enter">
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
      </div>
    )
  }

  return (
    <div className="landing-bg" style={{ minHeight: '100vh', position: 'relative' }}>
      <div style={{ maxWidth: 1240, margin: '0 auto', padding: isMobile ? '32px 20px' : '52px 40px' }} className="page-enter">
        <title>Reminisce — Command Center</title>

        {/* HERO SECTION */}
        <section style={{
          marginBottom: 48,
        }}>
          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', gap: 20, marginBottom: 32 }}>
            <div>
              <div style={{ fontSize: 9, letterSpacing: '0.22em', color: 'rgba(255,255,255,0.25)', marginBottom: 10, textTransform: 'uppercase' as const, fontWeight: 800 }}>
                Workspace
              </div>
              <h1 style={{ fontSize: isMobile ? 32 : 'clamp(28px, 3.5vw, 48px)', fontWeight: 900, letterSpacing: '-0.04em', color: '#fff', lineHeight: 1, margin: 0 }}>
                Projects
              </h1>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', marginTop: 8 }}>
                {projects.length} project{projects.length !== 1 ? 's' : ''} · {workspaces.length} group{workspaces.length !== 1 ? 's' : ''}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
              {userPlan && userPlan.plan === 'free' && (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  gap: 6,
                }}>
                  <div style={{
                    width: 140,
                    height: 4,
                    background: 'rgba(255,255,255,0.07)',
                    borderRadius: 999,
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${Math.min(
                        (projects.length / (userPlan?.projects_limit ?? 2))
                        * 100, 100
                      )}%`,
                      background: projects.length >=
                        (userPlan?.projects_limit ?? 2)
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
                    {projects.length}/{userPlan?.projects_limit ?? 2} projects
                    {projects.length >= (userPlan?.projects_limit ?? 2) && (
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
                          `Free tier allows ${userPlan?.projects_limit ?? 2} projects. Upgrade to Pro for unlimited.`,
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
            </div>
          </div>

          {wallet !== null && (
            <div style={{
              display: 'flex', gap: 8,
              flexWrap: 'wrap',
              marginBottom: 24,
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 14px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 10,
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
              }}>
                <span style={{ fontSize: 14 }}>🪙</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{wallet.coins}</span>
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>coins</span>
              </div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 14px',
                background: userPlan?.plan === 'pro' ? 'rgba(139,92,246,0.08)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${userPlan?.plan === 'pro' ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 10,
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
              }}>
                <span style={{ fontSize: 14 }}>💎</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: userPlan?.plan === 'pro' ? '#a78bfa' : '#fff' }}>{wallet.gems}</span>
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>gems</span>
              </div>
            </div>
          )}
        </section>

        {/* ── First-run onboarding ─────────────────────────────────── */}
        {!dismissedOnboarding && projects.length === 0 && (
          <div style={{
            marginBottom: 32,
            background: hexToRgba(accent, 0.05),
            border: `1px solid ${hexToRgba(accent, 0.18)}`,
            borderRadius: 20, padding: '28px 32px',
            position: 'relative',
          }}>
            {/* Dismiss button */}
            <button
              onClick={() => {
                localStorage.setItem('reminisce_onboarding_dismissed', '1')
                setDismissedOnboarding(true)
              }}
              style={{
                position: 'absolute', top: 16, right: 16,
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'rgba(255,255,255,0.25)', fontSize: 18, lineHeight: 1,
              }}
            >×</button>

            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: accent, marginBottom: 12 }}>
              Get started
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', margin: '0 0 8px' }}>
              Three steps to your first AI-ready project
            </h2>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', margin: '0 0 24px', lineHeight: 1.6 }}>
              Reminisce keeps your project context structured so every AI call knows exactly what you&apos;re building.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 14 }}>
              {[
                {
                  step: '01',
                  title: 'Create a project',
                  desc: 'Click "New project" above. Give it a name and optionally paste your GitHub repo URL.',
                  done: projects.length > 0,
                },
                {
                  step: '02',
                  title: 'Run the Wizard',
                  desc: 'Open your project → Wizard. Describe what you\'re building. Reminisce generates your entire blueprint in one run.',
                  done: false,
                },
                {
                  step: '03',
                  title: 'Connect your folder',
                  desc: 'In your project overview, click "Connect Folder" to link your local repo. Context files sync automatically.',
                  done: false,
                },
              ].map((item, i) => (
                <div key={i} style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 14, padding: '18px 20px',
                }}>
                  <div style={{
                    fontSize: 9, fontWeight: 800, letterSpacing: '0.14em',
                    color: item.done ? '#10b981' : hexToRgba(accent, 0.6),
                    marginBottom: 8,
                    textTransform: 'uppercase',
                  }}>
                    {item.done ? '✓ Done' : `Step ${item.step}`}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 6 }}>
                    {item.title}
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)', lineHeight: 1.6 }}>
                    {item.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.09)',
              borderRadius: 14,
              padding: '12px 16px 12px 44px',
              fontSize: 13, color: '#fff',
              outline: 'none', fontFamily: 'inherit',
              boxSizing: 'border-box',
              transition: 'border-color 0.2s',
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
          fontSize: 9, fontWeight: 700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.2)',
          marginBottom: 8,
        }}>
          Filter by Group
        </div>
        <div style={{
          display: 'flex',
          gap: 4,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          marginBottom: 28,
          overflowX: 'auto'
        }} className="hide-scrollbar">
          <button
            onClick={() => setSelectedWS('all')}
            style={{
              padding: '9px 18px',
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
                padding: '9px 18px',
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
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 20,
                  background: 'rgba(255,255,255,0.025)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  padding: '28px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  position: 'relative' as const,
                  overflow: 'hidden',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = hexToRgba(accent, 0.35)
                  e.currentTarget.style.background = hexToRgba(accent, 0.04)
                  e.currentTarget.style.transform = 'translateY(-3px)'
                  e.currentTarget.style.boxShadow = `0 16px 48px rgba(0,0,0,0.3), 0 0 0 1px ${hexToRgba(accent, 0.08)}`
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'
                  e.currentTarget.style.background = 'rgba(255,255,255,0.025)'
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = 'none'
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
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                    <span style={{
                      display: 'flex', alignItems: 'center',
                      gap: 4, fontSize: 9, fontWeight: 700,
                      color: '#10b981', letterSpacing: '0.06em',
                    }}>
                      <span style={{
                        width: 5, height: 5, borderRadius: '50%',
                        background: '#10b981',
                        animation: 'agentPulse 2s infinite',
                        display: 'inline-block',
                      }} />
                      Active
                    </span>
                    {stats?.lastRun && (
                      <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', fontWeight: 500 }}>
                        {new Date(stats.lastRun).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                  </div>
                </div>

                {/* Project name */}
                <h2 style={{
                  fontSize: 18, fontWeight: 700,
                  letterSpacing: '-0.02em', color: '#fff',
                  margin: '0 0 6px', lineHeight: 1.2,
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

                </div>

                {/* Tech stack chips */}
                {p.tech_stack && p.tech_stack.length > 0 && (
                  <div style={{
                    display: 'flex', gap: 5,
                    flexWrap: 'wrap',
                    marginBottom: 14,
                  }}>
                    {p.tech_stack.slice(0, 4).map((tech, ti) => (
                      <span key={ti} style={{
                        fontSize: 9, fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 999,
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        color: 'rgba(255,255,255,0.4)',
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                      }}>
                        {tech}
                      </span>
                    ))}
                    {p.tech_stack.length > 4 && (
                      <span style={{
                        fontSize: 9, fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 999,
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        color: 'rgba(255,255,255,0.25)',
                      }}>
                        +{p.tech_stack.length - 4}
                      </span>
                    )}
                  </div>
                )}

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
                      gap: 5, fontSize: 11, fontWeight: 700,
                      color: 'rgba(255,255,255,0.5)',
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 999,
                      padding: '5px 12px',
                      cursor: 'pointer',
                      letterSpacing: '0.04em',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.color = accent
                      e.currentTarget.style.borderColor = hexToRgba(accent, 0.3)
                      e.currentTarget.style.background = hexToRgba(accent, 0.06)
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.color = 'rgba(255,255,255,0.5)'
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
                      e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                    }}
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
              borderRadius: 20,
              background: 'transparent',
              display: 'flex', flexDirection: 'column' as const,
              alignItems: 'center', justifyContent: 'center',
              gap: 10, minHeight: 220,
              cursor: 'pointer', transition: 'all 0.2s',
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
        </div>      {(
          <div style={{
            marginTop: 40,
            padding: '20px 24px',
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 18,
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8, marginBottom: 16,
            }}>
              <span style={{ fontSize: 14 }}>⊞</span>
              <span style={{
                fontSize: 9, fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.3)',
              }}>
                Groups
              </span>
            </div>
            <div style={{
              display: 'flex', gap: 8,
              flexWrap: 'wrap',
            }}>
              {workspaces.map(w => (
                <div
                  key={w.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    borderRadius: 999,
                    border: `1px solid ${selectedWS === w.id
                        ? accent
                        : 'rgba(255,255,255,0.15)'
                      }`,
                    background: selectedWS === w.id
                      ? hexToRgba(accent, 0.1)
                      : 'rgba(255,255,255,0.04)',
                    overflow: 'hidden',
                    transition: 'all 0.15s',
                  }}
                >
                  <button
                    onClick={() => setSelectedWS(w.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center', gap: 6,
                      padding: '6px 10px 6px 14px',
                      background: 'transparent',
                      border: 'none',
                      color: selectedWS === w.id
                        ? accent
                        : 'rgba(255,255,255,0.6)',
                      fontSize: 11, fontWeight: 700,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
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
                      {projects.filter(p => p.workspace_id === w.id).length}
                    </span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteWorkspace(w.id, w.name)
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      borderLeft: '1px solid rgba(255,255,255,0.08)',
                      color: 'rgba(255,255,255,0.25)',
                      fontSize: 14,
                      cursor: 'pointer',
                      padding: '6px 10px',
                      lineHeight: 1,
                      transition: 'color 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.25)'}
                    title={`Delete Group ${w.name}`}
                  >
                    ×
                  </button>
                </div>
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
                + New Group
              </button>
            </div>
          </div>
        )}

        {/* Dialogs */}
        <Dialog
          open={isProjectOpen}
          onOpenChange={(open) => {
            setIsProjectOpen(open)
            if (!open) {
              setProjName('')
              setProjDesc('')
              setProjUrl('')
              setModalDirHandle(null)
              setModalFolderName(null)
            }
          }}
        >
          <DialogContent style={{ background: 'rgba(10,10,20,0.95)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 20 }}>
            <DialogHeader><DialogTitle style={{ color: '#fff', fontWeight: 700 }}>New project</DialogTitle></DialogHeader>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '20px 0' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Group</Label>
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
                <Label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                  Description <span style={{ color: 'rgba(255,255,255,0.2)', fontWeight: 400 }}>(optional)</span>
                </Label>
                <Input
                  value={projDesc}
                  onChange={e => setProjDesc(e.target.value)}
                  placeholder="What are you building?"
                  style={{ height: 44, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                  Repository URL <span style={{ color: 'rgba(255,255,255,0.2)', fontWeight: 400 }}>(optional)</span>
                </Label>
                <Input
                  value={projUrl}
                  onChange={e => setProjUrl(e.target.value)}
                  placeholder="https://github.com/username/repo"
                  style={{ height: 44, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', outline: 'none', fontFamily: 'monospace', fontSize: 12 }}
                />
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', lineHeight: 1.5 }}>
                  Public repos are enriched automatically during blueprint generation.
                </div>
              </div>
              </div>
            {isFsSupported && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Project folder <span style={{ color: 'rgba(255,255,255,0.2)' }}>(optional)</span></Label>
                <button
                  type="button"
                  onClick={handlePickFolderInModal}
                  style={{
                    height: 44,
                    background: modalFolderName ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${modalFolderName ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: 8,
                    color: modalFolderName ? '#10b981' : 'rgba(255,255,255,0.4)',
                    fontSize: 13,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '0 14px',
                    textAlign: 'left',
                    width: '100%',
                  }}
                >
                  {modalFolderName
                    ? <><CheckCircle2 size={14} />{modalFolderName}</>
                    : <><FolderOpen size={14} />Select parent folder...</>}
                </button>
              </div>
            )}
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
          <DialogContent style={{ background: 'rgba(10,10,20,0.95)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 20 }}>
            <DialogHeader><DialogTitle style={{ color: '#fff', fontWeight: 700 }}>New Group</DialogTitle></DialogHeader>
            <div style={{ padding: '20px 0' }}>
              <Label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 8, display: 'block' }}>Group name</Label>
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
    {/* ── In-page workspace delete confirm modal ── */}
    {confirmDelete && (
      <div style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}>
        <div style={{
          background: 'rgba(14,14,28,0.98)',
          border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 18,
          padding: '28px 32px',
          maxWidth: 420,
          width: '100%',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        }}>
          <div style={{
            fontSize: 18, fontWeight: 800,
            color: '#fff', marginBottom: 10,
          }}>
            Delete group?
          </div>
          <div style={{
            fontSize: 13, color: 'rgba(255,255,255,0.5)',
            lineHeight: 1.6, marginBottom: 24,
          }}>
            Are you sure you want to delete{' '}
            <span style={{ color: '#fff', fontWeight: 700 }}>
              &quot;{confirmDelete.name}&quot;
            </span>
            ? This action cannot be undone.
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button
              onClick={() => setConfirmDelete(null)}
              disabled={isDeleting}
              style={{
                padding: '9px 20px',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 10, cursor: 'pointer',
                fontSize: 13, fontWeight: 600,
                color: 'rgba(255,255,255,0.6)',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmDeleteWorkspace}
              disabled={isDeleting}
              style={{
                padding: '9px 20px',
                background: '#ef4444',
                border: 'none',
                borderRadius: 10, cursor: 'pointer',
                fontSize: 13, fontWeight: 700,
                color: '#fff',
                opacity: isDeleting ? 0.6 : 1,
              }}
            >
              {isDeleting ? 'Deleting...' : 'Delete group'}
            </button>
          </div>
        </div>
      </div>
    )}
    </div>
  )
}
