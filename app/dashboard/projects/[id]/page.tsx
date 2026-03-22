'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import Link from 'next/link'
import { useTheme } from '@/hooks/useTheme'
import { FolderOpen } from 'lucide-react'
import ExportBriefModal from '@/components/ExportBriefModal'
import { useFileSystem } from '@/hooks/useFileSystem'


interface Project {
  id: string
  name: string
  description: string | null
  type?: string
  cluster?: string
  created_at?: string
}

interface Phase {
  id: string
  name: string
  description: string
  order_index?: number
}

interface Feature {
  id: string
  name: string
  description?: string
  phase_id: string
  status?: string
  phases?: { name: string }
}

function hexToRgba(hex: string, a: number) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

export default function ProjectOverviewPage() {
  const params = useParams()
  const router = useRouter()
  const { accent } = useTheme()
  const projectId = params.id as string

  const { 
    isConnected, isSupported, 
    openFolder 
  } = useFileSystem()
  
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [phases, setPhases] = useState<Phase[]>([])
  const [features, setFeatures] = useState<Feature[]>([])
  const [contextDoc, setContextDoc] = useState('')
  const [showExport, setShowExport] = useState(false)
  
  const loadData = useCallback(async () => {
    try {
      const [{ data: proj }, { data: pData }, { data: fData }, { data: ctxData }] = await Promise.all([
        supabase.from('projects').select('*').eq('id', projectId).single(),
        supabase.from('phases').select('*').eq('project_id', projectId).order('order_index', { ascending: true }),
        supabase.from('features').select('*, phases(name)').eq('project_id', projectId).order('created_at', { ascending: false }),
        supabase.from('context_versions').select('content').eq('project_id', projectId).order('created_at', { ascending: false }).limit(1).maybeSingle()
      ])
      
      if (!proj) throw new Error('Project not found')
      setProject(proj as Project)
      setPhases(pData || [])
      setFeatures(fData || [])
      setContextDoc(ctxData?.content || '')

    } catch (err) { 
      console.error(err)
      toast.error('Query failure'); 
      router.push('/dashboard') 
    }
    finally { setLoading(false) }
  }, [projectId, router])

  useEffect(() => { loadData() }, [loadData])

  if (loading) return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 32px' }}>
      <div style={{ width: 300, height: 48, background: 'rgba(255,255,255,0.05)', borderRadius: 8 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24, marginTop: 48 }}>
        {[...Array(4)].map((_, i) => <div key={i} style={{ height: 120, background: 'rgba(255,255,255,0.03)', borderRadius: 12 }} />)}
      </div>
    </div>
  )
  
  if (!project) return <div style={{ padding: 100, textAlign: 'center', color: '#ef4444', fontWeight: 900 }}>404: MISSING PROJECT DOMAIN</div>

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 32px' }}>
      <title>{`Reminisce — Overview — ${project.name}`}</title>
      
      {/* Live indicator + name */}
      <div style={{ marginBottom: 24 }}>
        <div style={{
          display: 'flex', alignItems: 'center',
          gap: 8, marginBottom: 8,
        }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%',
            background: '#10b981',
            display: 'inline-block',
            animation: 'agentPulse 2s infinite',
          }} />
          <span style={{
            fontSize: 10, fontWeight: 700,
            color: 'rgba(255,255,255,0.35)',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}>
            Live · {project?.name}
          </span>
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}>
          <div>
            <h1 style={{
              fontSize: 36, fontWeight: 800,
              color: '#fff', letterSpacing: '-0.02em',
              margin: '0 0 4px',
            }}>
              {project?.name}
            </h1>
            <div style={{
              fontSize: 13,
              color: 'rgba(255,255,255,0.35)',
            }}>
              {project?.description || 'No description'}
            </div>
          </div>
          <button
            onClick={() => setShowExport(true)}
            style={{
              display: 'flex', alignItems: 'center',
              gap: 6, padding: '8px 16px',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, background: 'transparent',
              color: 'rgba(255,255,255,0.5)',
              fontSize: 12, fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = accent
              e.currentTarget.style.color = accent
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor =
                'rgba(255,255,255,0.1)'
              e.currentTarget.style.color =
                'rgba(255,255,255,0.5)'
            }}
          >
            ↓ Export Brief
          </button>
        </div>
      </div>

      {/* 4 stat cards row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 12, marginBottom: 24,
      }}>
        {[
          { icon: '⊕', value: phases.length,
            label: 'Phases', color: accent },
          { icon: '</>', value: features.length,
            label: 'Features', color: '#3b82f6' },
          { icon: '↗', value: 0,
            label: 'Active', color: '#10b981' },
          { icon: '◎', value: '0%',
            label: 'Progress', color: accent },
        ].map((stat, i) => (
          <div key={i} style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 10, padding: '14px 16px',
            display: 'flex', alignItems: 'center',
            gap: 12,
          }}>
            <div style={{
              width: 36, height: 36,
              borderRadius: 8,
              background: `${stat.color}15`,
              display: 'flex', alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16, flexShrink: 0,
            }}>
              {stat.icon}
            </div>
            <div>
              <div style={{
                fontSize: 22, fontWeight: 800,
                color: stat.color, lineHeight: 1,
                marginBottom: 2,
              }}>
                {stat.value}
              </div>
              <div style={{
                fontSize: 9, fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.3)',
              }}>
                {stat.label}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Overall Progress bar */}
      <div style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 10, padding: '16px 20px',
        marginBottom: 24,
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 10,
        }}>
          <span style={{
            fontSize: 12, fontWeight: 600,
            color: 'rgba(255,255,255,0.6)',
          }}>
            Overall Progress
          </span>
          <span style={{
            fontSize: 11, fontWeight: 600,
            color: accent,
          }}>
            0/{features.length} features complete
          </span>
        </div>
        <div style={{
          height: 6,
          background: 'rgba(255,255,255,0.08)',
          borderRadius: 999, overflow: 'hidden',
          marginBottom: 10,
        }}>
          <div style={{
            height: '100%', width: '0%',
            background: accent, borderRadius: 999,
          }} />
        </div>
        <div style={{
          display: 'flex', gap: 16, fontSize: 11,
        }}>
          {[
            { dot: '#10b981', label: '0 Complete' },
            { dot: accent,    label: '0 Active' },
            { dot: 'rgba(255,255,255,0.2)',
              label: `${features.length} Pending` },
          ].map((item, i) => (
            <span key={i} style={{
              display: 'flex', alignItems: 'center',
              gap: 5, color: 'rgba(255,255,255,0.35)',
            }}>
              <span style={{
                width: 7, height: 7,
                borderRadius: '50%',
                background: item.dot,
                flexShrink: 0,
              }} />
              {item.label}
            </span>
          ))}
        </div>
      </div>

      {/* 3 Quick action cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 12, marginBottom: 32,
      }}>
        {[
          {
            icon: '✦', label: 'Run Wizard',
            desc: 'Generate or update your blueprint',
            href: `/dashboard/projects/${projectId}/wizard`,
            color: '#b45309',
            bg: 'rgba(180,83,9,0.12)',
          },
          {
            icon: '⊞', label: 'View Graph',
            desc: 'Explore node relationships',
            href: `/dashboard/projects/${projectId}/graph`,
            color: '#1d4ed8',
            bg: 'rgba(29,78,216,0.12)',
          },
          {
            icon: '◎', label: 'Ask Agent',
            desc: 'Converse with project context',
            href: `/dashboard/projects/${projectId}/agent`,
            color: '#6d28d9',
            bg: 'rgba(109,40,217,0.12)',
          },
        ].map(action => (
          <Link
            key={action.label}
            href={action.href}
            style={{
              display: 'flex', flexDirection: 'column',
              padding: '18px 20px',
              background: action.bg,
              border: `1px solid ${action.color}30`,
              borderRadius: 12,
              textDecoration: 'none',
              transition: 'all 0.15s',
              position: 'relative',
              overflow: 'hidden',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor =
                action.color + '60'
              e.currentTarget.style.transform =
                'translateY(-1px)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor =
                action.color + '30'
              e.currentTarget.style.transform =
                'translateY(0)'
            }}
          >
            <span style={{
              position: 'absolute', top: 12, right: 14,
              color: 'rgba(255,255,255,0.2)',
              fontSize: 14,
            }}>→</span>
            <span style={{
              fontSize: 20, marginBottom: 12,
              color: action.color,
            }}>
              {action.icon}
            </span>
            <span style={{
              fontSize: 14, fontWeight: 700,
              color: '#fff', marginBottom: 4,
            }}>
              {action.label}
            </span>
            <span style={{
              fontSize: 11,
              color: 'rgba(255,255,255,0.4)',
              lineHeight: 1.4,
            }}>
              {action.desc}
            </span>
          </Link>
        ))}
      </div>

      {isSupported && !isConnected && (
        <div style={{
          margin: '0 0 24px',
          padding: '14px 20px',
          background: hexToRgba(accent, 0.06),
          border: `1px solid ${hexToRgba(accent, 0.2)}`,
          borderRadius: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}>
          <div>
            <div style={{
              fontSize: 13, fontWeight: 600,
              color: '#fff', marginBottom: 3,
            }}>
              Connect your project folder
            </div>
            <div style={{
              fontSize: 12,
              color: 'rgba(255,255,255,0.4)',
            }}>
              Link a local folder to read and write
              context files directly to disk.
            </div>
          </div>
          <button
            onClick={openFolder}
            style={{
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center', gap: 6,
              padding: '8px 16px',
              background: accent, color: '#000',
              border: 'none', borderRadius: 8,
              fontSize: 12, fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            <FolderOpen size={14} />
            Connect Folder
          </button>
        </div>
      )}

      {isConnected && (
        <div style={{
          margin: '0 0 24px',
          padding: '10px 16px',
          background: 'rgba(16,185,129,0.06)',
          border: '1px solid rgba(16,185,129,0.2)',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 12,
          color: '#10b981',
        }}>
          <span style={{ fontSize: 14 }}>✓</span>
          Local folder connected — context files 
          sync automatically
        </div>
      )}

      {/* PHASES SECTION */}
      <section style={{ marginBottom: 64 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: '#fff', letterSpacing: '0.02em', margin: 0 }}>Phases</h2>
          <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', borderRadius: 6, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>
            {phases.length}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {phases.length === 0 ? (
            <div style={{
              padding: '64px 32px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
              background: 'rgba(255,255,255,0.01)',
              borderRadius: 16,
              border: '1px dashed rgba(255,255,255,0.06)'
            }}>
              <div style={{
                width: 48, height: 48,
                borderRadius: 12,
                background: `rgba(${parseInt(accent.slice(1,3),16)},${parseInt(accent.slice(3,5),16)},${parseInt(accent.slice(5,7),16)}, 0.08)`,
                border: `1px solid rgba(${parseInt(accent.slice(1,3),16)},${parseInt(accent.slice(3,5),16)},${parseInt(accent.slice(5,7),16)}, 0.2)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
              }}>✦</div>
              <div style={{
                fontSize: 15, fontWeight: 600,
                color: 'rgba(255,255,255,0.5)',
              }}>
                No phases yet
              </div>
              <div style={{
                fontSize: 13,
                color: 'rgba(255,255,255,0.25)',
                maxWidth: 280, lineHeight: 1.6,
              }}>
                Run the Wizard to generate phases 
                and features for this project.
              </div>
              <Link
                href={`/dashboard/projects/${projectId}/wizard`}
                style={{
                  marginTop: 8,
                  display: 'inline-flex',
                  alignItems: 'center', gap: 6,
                  padding: '9px 20px',
                  background: accent, color: '#000',
                  borderRadius: 8,
                  fontSize: 12, fontWeight: 700,
                  textDecoration: 'none',
                  transition: 'opacity 0.15s',
                }}
              >
                Open Wizard →
              </Link>
            </div>
          ) : (
            phases.map((phase) => (
              <div key={phase.id} style={{
                padding: '16px 20px',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 10, marginBottom: 8,
                display: 'flex', alignItems: 'flex-start',
                gap: 14,
              }}>
                {/* Phase badge */}
                <div style={{
                  width: 32, height: 32,
                  borderRadius: '50%',
                  background: hexToRgba(accent, 0.15),
                  border: `1px solid ${hexToRgba(accent, 0.3)}`,
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10, fontWeight: 800,
                  color: accent, flexShrink: 0,
                  letterSpacing: '0.02em',
                }}>
                  P{(phase.order_index || 0) + 1}
                </div>
                
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: 4,
                  }}>
                    <span style={{
                      fontSize: 14, fontWeight: 600,
                      color: '#fff',
                    }}>
                      {phase.name}
                    </span>
                    <div style={{
                      display: 'flex', alignItems: 'center',
                      gap: 8, flexShrink: 0,
                    }}>
                      <span style={{
                        fontSize: 11,
                        color: 'rgba(255,255,255,0.3)',
                      }}>
                        0/{features.filter(f => f.phase_id === phase.id).length}
                      </span>
                      <span style={{
                        fontSize: 9, fontWeight: 700,
                        padding: '2px 7px', borderRadius: 999,
                        background: 'rgba(255,255,255,0.07)',
                        color: 'rgba(255,255,255,0.4)',
                        letterSpacing: '0.06em',
                      }}>
                        {features.filter(f => f.phase_id === phase.id).length} features
                      </span>
                    </div>
                  </div>
                  <div style={{
                    fontSize: 12,
                    color: 'rgba(255,255,255,0.35)',
                    marginBottom: 8, lineHeight: 1.4,
                  }}>
                    {phase.description}
                  </div>
                  {/* Phase progress bar */}
                  <div style={{
                    height: 2,
                    background: 'rgba(255,255,255,0.07)',
                    borderRadius: 999,
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%', width: '0%',
                      background: accent, borderRadius: 999,
                    }} />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>



      {showExport && project && (
        <ExportBriefModal
          data={{
            project: {
              name: project.name,
              type: project.type,
              cluster: project.cluster,
              created_at: project.created_at,
            },
            phases: phases.map(p => ({
              id: p.id,
              name: p.name,
              description: p.description,
              order: p.order_index
            })),
            features: features.map(f => ({
              id: f.id,
              name: f.name,
              description: f.description,
              phase_id: f.phase_id,
              status: f.status
            })),
            context: contextDoc || '',
          }}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  )
}
