'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { 
  Trash2, 
} from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import { toast } from 'sonner'
import { ThemeSwitcher } from '@/components/theme-switcher'
import type { User as SupabaseUser } from '@supabase/supabase-js'

function hexToRgba(hex: string, a: number) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

interface Project {
  id: string
  name: string
  type: string
  cluster: string
}

const PROVIDERS = [
  { id: 'anthropic', name: 'Anthropic', placeholder: 'sk-ant-...' },
  { id: 'openrouter', name: 'OpenRouter', placeholder: 'sk-or-...' },
  { id: 'mistral', name: 'Mistral', placeholder: '...' },
  { id: 'google', name: 'Google AI', placeholder: 'AIza...' },
  { id: 'minimax', name: 'MiniMax', placeholder: '...' },
]

export default function SettingsPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string
  const { accent } = useTheme()

  const [activeTab, setActiveTab] = useState('aesthetics')
  const [loading, setLoading] = useState(true)
  const [project, setProject] = useState<Project | null>(null)
  const [user, setUser] = useState<SupabaseUser | null>(null)

  const [configuredProviders, setConfiguredProviders] = useState<string[]>([])
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({})
  
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const fetchKeys = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/keys/list', {
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      })
      const data = await res.json()
      if (data.providers) setConfiguredProviders(data.providers)
    } catch { }
  }, [])

  useEffect(() => {
    const init = async () => {
      const [{ data: proj }, { data: authUser }] = await Promise.all([
        supabase.from('projects').select('*').eq('id', projectId).single(),
        supabase.auth.getUser()
      ])
      if (proj) setProject(proj)
      if (authUser?.user) setUser(authUser.user)
      await fetchKeys()
      setLoading(false)
    }
    init()
  }, [projectId, fetchKeys])

  const saveKey = async (provider: string) => {
    const apiKey = keyInputs[provider]
    if (!apiKey) return
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/keys/save', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}` 
        },
        body: JSON.stringify({ provider, apiKey })
      })
      if (!res.ok) throw new Error('Save failed')
      toast.success(`${provider.toUpperCase()} key secured`)
      setKeyInputs(prev => ({ ...prev, [provider]: '' }))
      fetchKeys()
    } catch {
      toast.error('Failed to secure key')
    }
  }

  const deleteKey = async (provider: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/keys/delete', {
        method: 'DELETE',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}` 
        },
        body: JSON.stringify({ provider })
      })
      if (!res.ok) throw new Error('Delete failed')
      toast.success(`${provider.toUpperCase()} key purged`)
      fetchKeys()
    } catch {
      toast.error('Purge failed')
    }
  }

  const handleUpdateProject = async () => {
    if (!project) return
    try {
      const { error } = await supabase.from('projects')
        .update({ 
          name: project.name, 
          type: project.type, 
          cluster: project.cluster 
        })
        .eq('id', projectId)
      if (error) throw error
      toast.success('Project configuration updated')
    } catch {
      toast.error('Update failed')
    }
  }

  const handleDeleteProject = async () => {
    const confirm = window.confirm('RE-INITIALIZE PERMANENT PURGE? All domain metadata will be lost.')
    if (!confirm) return
    try {
      const { error } = await supabase.from('projects').delete().eq('id', projectId)
      if (error) throw error
      toast.success('Mission Purged')
      router.push('/dashboard')
    } catch {
      toast.error('Purge failed')
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) return <div style={{ padding: 48, background: '#000', color: '#fff' }} className="page-enter">Calibrating Settings...</div>

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: isMobile ? '32px 20px' : '48px 32px' }} className="page-enter">
      <title>{`Settings — ${project?.name}`}</title>
      
      <div style={{ marginBottom: 48 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', marginBottom: 4 }}>
          Settings
        </h1>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>
          Configure your project and workspace preferences.
        </p>
      </div>

      {/* TAB NAVIGATION */}
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: 40, display: 'flex', gap: 0, overflowX: 'auto' }} className="hide-scrollbar">
        {['Workspace', 'Models', 'Aesthetics', 'Advanced'].map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t.toLowerCase())}
            style={{
              padding: '10px 20px',
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: '0.03em',
              textTransform: 'none',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              borderBottom: `2px solid ${activeTab === t.toLowerCase() ? accent : 'transparent'}`,
              marginBottom: -1,
              color: activeTab === t.toLowerCase() ? accent : 'rgba(255,255,255,0.3)',
              transition: 'all 0.2s',
              minWidth: 'max-content'
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* TAB CONTENT */}
      <div>
        {activeTab === 'aesthetics' && (
          <div className="page-enter">
            <h3 style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.03em', textTransform: 'none', color: 'rgba(255,255,255,0.35)', marginBottom: 24 }}>
              Visual frequency
            </h3>
            <ThemeSwitcher />
          </div>
        )}

        {activeTab === 'models' && (
          <div className="page-enter">
            <h3 style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.03em', textTransform: 'none', color: 'rgba(255,255,255,0.35)', marginBottom: 8 }}>
              Models
            </h3>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 32 }}>
              Connect your AI providers to enable model routing and context injection.
            </p>

            {PROVIDERS.map(p => {
              const connected = configuredProviders.includes(p.id)
              return (
                <div key={p.id} style={{ 
                  border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, 
                  padding: isMobile ? '16px 20px' : '20px 24px', marginBottom: 12, background: 'rgba(255,255,255,0.02)' 
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{p.name}</span>
                      <span style={{ 
                        marginLeft: 10, 
                        background: connected ? hexToRgba('#10b981', 0.1) : 'rgba(255,255,255,0.05)',
                        border: `1px solid ${connected ? hexToRgba('#10b981', 0.3) : 'rgba(255,255,255,0.1)'}`,
                        color: connected ? '#10b981' : 'rgba(255,255,255,0.25)',
                        borderRadius: 999, padding: '2px 8px', fontSize: 9, 
                        fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase'
                      }}>
                        {connected ? 'CONNECTED' : 'NOT CONFIGURED'}
                      </span>
                    </div>
                    {connected && (
                      <button 
                        onClick={() => deleteKey(p.id)}
                        style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.2)', cursor: 'pointer', transition: 'all 0.2s' }}
                        onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                        onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.2)'}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  <div style={{ marginTop: 12, display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 8 }}>
                    <input 
                      type="password" 
                      placeholder={p.placeholder}
                      value={keyInputs[p.id] || ''}
                      onChange={(e) => setKeyInputs(prev => ({ ...prev, [p.id]: e.target.value }))}
                      style={{
                        flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#fff', 
                        fontFamily: 'monospace', outline: 'none'
                      }}
                      onFocus={e => {
                        e.currentTarget.style.borderColor = accent
                        e.currentTarget.style.boxShadow = `0 0 0 3px ${hexToRgba(accent, 0.1)}`
                      }}
                      onBlur={e => {
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
                        e.currentTarget.style.boxShadow = 'none'
                      }}
                    />
                    <button 
                      onClick={() => saveKey(p.id)}
                      style={{
                        background: accent, color: '#000', border: 'none', borderRadius: 8,
                        padding: '10px 16px', fontSize: 11, fontWeight: 800, 
                        textTransform: 'uppercase', cursor: 'pointer', whiteSpace: 'nowrap',
                        transition: 'all 200ms cubic-bezier(0.19, 1, 0.22, 1)'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.transform = 'scale(1.02)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scale(1)' }}
                    >
                      SAVE KEY
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {activeTab === 'workspace' && project && (
          <div className="page-enter">
            <h3 style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.03em', textTransform: 'none', color: 'rgba(255,255,255,0.35)', marginBottom: 24 }}>
              Workspace
            </h3>

            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.45)', textTransform: 'none', letterSpacing: 'normal', display: 'block', marginBottom: 8 }}>Project name</label>
              <input 
                type="text" 
                value={project.name}
                onChange={(e) => setProject({ ...project, name: e.target.value })}
                onFocus={e => {
                  e.currentTarget.style.borderColor = accent
                  e.currentTarget.style.boxShadow = `0 0 0 3px ${hexToRgba(accent, 0.1)}`
                }}
                onBlur={e => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
                style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: '#fff', outline: 'none', transition: 'all 0.2s' }}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Project Type</label>
              <input 
                type="text" 
                value={project.type}
                onChange={(e) => setProject({ ...project, type: e.target.value })}
                style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: '#fff', outline: 'none' }}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Cluster Assignment</label>
              <input 
                type="text" 
                value={project.cluster}
                onChange={(e) => setProject({ ...project, cluster: e.target.value })}
                style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: '#fff', outline: 'none' }}
              />
            </div>

            <button 
              onClick={handleUpdateProject}
              style={{
                background: accent, color: '#000', border: 'none', borderRadius: 999,
                padding: '12px 32px', fontSize: 11, fontWeight: 800, 
                textTransform: 'uppercase', cursor: 'pointer', marginTop: 12,
                transition: 'all 200ms cubic-bezier(0.19, 1, 0.22, 1)'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.transform = 'scale(1.02)' }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scale(1)' }}
            >
              SAVE CHANGES
            </button>

            <div style={{ marginTop: 48, border: '1px solid rgba(239,68,68,0.2)', borderRadius: 16, padding: 24 }}>
              <h4 style={{ fontSize: 11, fontWeight: 600, color: '#ef4444', textTransform: 'none', letterSpacing: 'normal', marginBottom: 16 }}>Danger zone</h4>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 20 }}>Deleting this mission will purge all archived metadata, feature specs, and context engine versions. This action is irreversible.</p>
              <button 
                onClick={handleDeleteProject}
                style={{
                  border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', background: 'transparent',
                  borderRadius: 8, padding: '10px 20px', fontSize: 12, fontWeight: 700, 
                  textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                DELETE PROJECT
              </button>
            </div>
          </div>
        )}

        {activeTab === 'advanced' && user && (
          <div className="page-enter">
            <h3 style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.03em', textTransform: 'none', color: 'rgba(255,255,255,0.35)', marginBottom: 24 }}>
              Advanced
            </h3>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', padding: '14px 0', gap: 16 }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>EMAIL</span>
              <span style={{ fontSize: isMobile ? 12 : 13, color: 'rgba(255,255,255,0.7)', fontFamily: 'monospace', wordBreak: 'break-all', textAlign: 'right' }}>{user.email}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', padding: '14px 0', gap: 16 }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>USER ID</span>
              <span style={{ fontSize: isMobile ? 12 : 13, color: 'rgba(255,255,255,0.7)', fontFamily: 'monospace', wordBreak: 'break-all', textAlign: 'right' }}>{user.id.slice(0, 16)}...</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', padding: '14px 0' }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)' }}>PLAN</span>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>Elite Access</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', padding: '14px 0' }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)' }}>MEMBER SINCE</span>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>{new Date(user.created_at).toLocaleDateString()}</span>
            </div>

            <button 
              onClick={handleSignOut}
              style={{
                marginTop: 32, border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)',
                background: 'transparent', borderRadius: 8, padding: '10px 20px', 
                fontSize: 12, fontWeight: 700, textTransform: 'none', cursor: 'pointer',
                transition: 'all 0.2s', width: isMobile ? '100%' : 'auto'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'; e.currentTarget.style.color = '#fff' }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'rgba(255,255,255,0.5)' }}
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
