'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import Link from 'next/link'
import { useTheme } from '@/hooks/useTheme'
import { Download } from 'lucide-react'
import ExportBriefModal from '@/components/ExportBriefModal'

interface DashboardStats {
  phasesCount: number
  phasesComplete: number
  featuresCount: number
  featuresComplete: number
  contextsCount: number
  lastUpdatedContext: string | null
}

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

export default function ProjectOverviewPage() {
  const params = useParams()
  const router = useRouter()
  const { accent } = useTheme()
  const projectId = params.id as string
  
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [phases, setPhases] = useState<Phase[]>([])
  const [features, setFeatures] = useState<Feature[]>([])
  const [contextDoc, setContextDoc] = useState('')
  const [showExport, setShowExport] = useState(false)
  
  const loadData = useCallback(async () => {
    try {
      const [{ data: proj }, { data: pData }, { data: fData }, { data: contexts }, { data: ctxData }] = await Promise.all([
        supabase.from('projects').select('*').eq('id', projectId).single(),
        supabase.from('phases').select('*').eq('project_id', projectId).order('order_index', { ascending: true }),
        supabase.from('features').select('*, phases(name)').eq('project_id', projectId).order('created_at', { ascending: false }),
        supabase.from('context_versions').select('id, created_at').eq('project_id', projectId).order('created_at', { ascending: false }),
        supabase.from('context_versions').select('content').eq('project_id', projectId).order('created_at', { ascending: false }).limit(1).maybeSingle()
      ])
      
      if (!proj) throw new Error('Project not found')
      setProject(proj as Project)
      setPhases(pData || [])
      setFeatures(fData || [])
      setContextDoc(ctxData?.content || '')

      setStats({
        phasesCount: pData?.length || 0,
        phasesComplete: pData?.filter(p => p.status === 'completed').length || 0,
        featuresCount: fData?.length || 0,
        featuresComplete: fData?.filter(f => f.status === 'completed').length || 0,
        contextsCount: contexts?.length || 0,
        lastUpdatedContext: contexts?.[0]?.created_at || null
      })
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
      
      {/* PROJECT HERO */}
      <section style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 64 }}>
        <div>
          <h1 style={{ fontSize: 'clamp(36px, 4vw, 56px)', fontWeight: 800, color: '#fff', margin: 0, lineHeight: 1 }}>
            {project.name}
          </h1>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', marginTop: 8 }}>
            {project.description || 'No description'}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 24 }}>
          <button
            onClick={() => setShowExport(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 20px',
              border: `1px solid rgba(255,255,255,0.12)`,
              borderRadius: 8,
              background: 'transparent',
              color: 'rgba(255,255,255,0.6)',
              fontSize: 12,
              fontWeight: 500,
              letterSpacing: 'normal',
              textTransform: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = accent
              e.currentTarget.style.color = '#fff'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'
              e.currentTarget.style.color = 'rgba(255,255,255,0.6)'
            }}
          >
            <Download size={14} />
            Export brief
          </button>

          <div style={{ display: 'flex', gap: 40 }}>
            <div>
              <div style={{ fontSize: 32, fontWeight: 900, color: '#fff' }}>{stats?.phasesCount || 0}</div>
              <div style={{ fontSize: 11, fontWeight: 400, color: 'rgba(255,255,255,0.35)', letterSpacing: 'normal', textTransform: 'none' }}>Phases</div>
            </div>
            <div>
              <div style={{ fontSize: 32, fontWeight: 900, color: '#fff' }}>{stats?.featuresCount || 0}</div>
              <div style={{ fontSize: 11, fontWeight: 400, color: 'rgba(255,255,255,0.35)', letterSpacing: 'normal', textTransform: 'none' }}>Features</div>
            </div>
            <div>
              <div style={{ fontSize: 32, fontWeight: 900, color: '#fff' }}>{stats?.contextsCount || 0}</div>
              <div style={{ fontSize: 11, fontWeight: 400, color: 'rgba(255,255,255,0.35)', letterSpacing: 'normal', textTransform: 'none' }}>Context files</div>
            </div>
          </div>
        </div>
      </section>

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
              <div 
                key={phase.id}
                style={{
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.02)',
                  padding: '20px 24px',
                  paddingLeft: 20,
                  position: 'relative',
                  transition: 'border-color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = `rgba(${parseInt(accent.slice(1,3),16)},${parseInt(accent.slice(3,5),16)},${parseInt(accent.slice(5,7),16)}, 0.2)`}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'}
              >
                <div style={{ width: 2, height: '100%', background: accent, borderRadius: 999, position: 'absolute', left: 0, top: 0 }} />
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{phase.name}</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>{phase.description}</div>
                  </div>
                  <div className="badge badge-neutral">
                    {features.filter(f => f.phase_id === phase.id).length} features
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* FEATURES SECTION */}
      <section style={{ marginBottom: 64 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: '#fff', letterSpacing: '0.02em', margin: 0 }}>Features</h2>
          <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', borderRadius: 6, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>
            {features.length}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: 16 }}>
          {features.map((feature) => (
            <div 
              key={feature.id}
              style={{
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 10,
                padding: '16px 20px',
                background: 'rgba(255,255,255,0.02)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.7)' }}>{feature.name}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 4 }}>
                  {feature.phases?.name || 'Unassigned'}
                </div>
              </div>
              <div className={`badge ${feature.status === 'completed' ? 'badge-success' : 'badge-neutral'}`}>
                {feature.status || 'pending'}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CONTEXT ACTIONS ROW */}
      <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
        <Link 
          href={`/dashboard/projects/${projectId}/context`}
          style={{
            border: `1px solid rgba(255,255,255,0.1)`,
            color: 'rgba(255,255,255,0.6)',
            borderRadius: 999,
            padding: '10px 24px',
            fontSize: 12,
            fontWeight: 600,
            textTransform: 'none',
            textDecoration: 'none',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => { 
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'
            e.currentTarget.style.color = '#fff'
          }}
          onMouseLeave={(e) => { 
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
            e.currentTarget.style.color = 'rgba(255,255,255,0.6)'
          }}
        >
          View context
        </Link>
        <Link 
          href={`/dashboard/projects/${projectId}/agent`}
          style={{
            border: `1px solid ${accent}`,
            color: accent,
            borderRadius: 999,
            padding: '10px 24px',
            fontSize: 12,
            fontWeight: 700,
            textTransform: 'none',
            textDecoration: 'none',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = `rgba(${parseInt(accent.slice(1,3),16)},${parseInt(accent.slice(3,5),16)},${parseInt(accent.slice(5,7),16)}, 0.05)` }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
        >
          Open agent
        </Link>
      </div>

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
