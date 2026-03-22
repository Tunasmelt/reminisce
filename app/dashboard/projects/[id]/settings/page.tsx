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
  const [userPlan, setUserPlan] = useState<'free' | 'pro'>('free')
  
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
      if (authUser?.user) {
        setUser(authUser.user)
        // Fetch plan
        const { data: planData } = await supabase
          .from('user_plans')
          .select('plan')
          .eq('user_id', authUser.user.id)
          .single()
        if (planData?.plan) {
          setUserPlan(planData.plan as 'free' | 'pro')
        }
      }
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
        <div style={{
          fontSize: 9, fontWeight: 700,
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          color: accent, marginBottom: 6,
        }}>
          Project Configuration
        </div>
        <h1 style={{
          fontSize: 28, fontWeight: 800,
          color: '#fff', letterSpacing: '-0.01em',
          marginBottom: 6,
        }}>
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
            <div style={{
              fontSize: 9, fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: accent, marginBottom: 4,
            }}>
              API Key Configuration
            </div>
            <div style={{
              fontSize: 13,
              color: 'rgba(255,255,255,0.5)',
              marginBottom: 24, lineHeight: 1.6,
            }}>
              Connect your AI providers to enable 
              model routing and context injection.
            </div>

            {userPlan !== 'pro' ? (
              /* ── LOCKED STATE for free users ── */
              <div style={{
                border: `1px solid ${hexToRgba(accent, 0.2)}`,
                borderRadius: 12,
                padding: '32px 28px',
                background: hexToRgba(accent, 0.04),
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 32, marginBottom: 14 }}>
                  🔒
                </div>
                <div style={{
                  fontSize: 16, fontWeight: 700,
                  color: '#fff', marginBottom: 8,
                }}>
                  BYOK is a Pro feature
                </div>
                <div style={{
                  fontSize: 13,
                  color: 'rgba(255,255,255,0.4)',
                  lineHeight: 1.65, marginBottom: 24,
                  maxWidth: 380, margin: '0 auto 24px',
                }}>
                  Bring Your Own Key (BYOK) lets you use 
                  your personal API keys for Anthropic, 
                  OpenRouter, Mistral, and more — bypassing 
                  the gem economy entirely. Available on Pro.
                </div>
                <div style={{
                  display: 'flex', gap: 8,
                  justifyContent: 'center',
                  flexWrap: 'wrap',
                }}>
                  {['Anthropic', 'OpenRouter', 'Mistral', 
                    'Google AI', 'MiniMax'].map(p => (
                    <span key={p} style={{
                      fontSize: 10, fontWeight: 600,
                      padding: '4px 12px',
                      borderRadius: 999,
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: 'rgba(255,255,255,0.35)',
                    }}>
                      {p}
                    </span>
                  ))}
                </div>
                <button
                  onClick={() => 
                    window.location.href = '/upgrade'
                  }
                  style={{
                    marginTop: 24,
                    display: 'inline-flex',
                    alignItems: 'center', gap: 6,
                    padding: '10px 24px',
                    background: accent, color: '#000',
                    border: 'none', borderRadius: 999,
                    fontSize: 12, fontWeight: 800,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                  }}
                >
                  Upgrade to Pro →
                </button>
              </div>
            ) : (
              /* ── UNLOCKED STATE for pro users ── */
              <div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center', gap: 8,
                  marginBottom: 20, padding: '10px 14px',
                  background: 'rgba(16,185,129,0.06)',
                  border: '1px solid rgba(16,185,129,0.2)',
                  borderRadius: 8,
                }}>
                  <span style={{ color: '#10b981' }}>✓</span>
                  <span style={{
                    fontSize: 12,
                    color: 'rgba(255,255,255,0.5)',
                  }}>
                    <strong style={{ color: '#10b981' }}>
                      Pro — BYOK active.
                    </strong>
                    {' '}Your own keys bypass the gem economy 
                    and have no usage limits from Reminisce.
                  </span>
                </div>
                {PROVIDERS.map(p => {
                  const isConfigured = 
                    configuredProviders.includes(p.id)
                  return (
                    <div
                      key={p.id}
                      style={{
                        padding: '16px 18px',
                        background: isConfigured
                          ? 'rgba(16,185,129,0.04)'
                          : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${isConfigured
                          ? 'rgba(16,185,129,0.2)'
                          : 'rgba(255,255,255,0.07)'}`,
                        borderRadius: 10,
                        marginBottom: 8,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center', gap: 8,
                          marginBottom: 8,
                        }}>
                          <span style={{
                            fontSize: 13, fontWeight: 600,
                            color: '#fff',
                          }}>
                            {p.name}
                          </span>
                          {isConfigured && (
                            <span style={{
                              fontSize: 9, fontWeight: 700,
                              padding: '2px 7px',
                              borderRadius: 999,
                              background: 'rgba(16,185,129,0.1)',
                              border: '1px solid rgba(16,185,129,0.25)',
                              color: '#10b981',
                              letterSpacing: '0.06em',
                              textTransform: 'uppercase',
                            }}>
                              Configured
                            </span>
                          )}
                        </div>
                        <div style={{
                          display: 'flex', gap: 8,
                        }}>
                          <input
                            type="password"
                            placeholder={isConfigured
                              ? '••••••••••••••••'
                              : p.placeholder}
                            value={keyInputs[p.id] || ''}
                            onChange={e => setKeyInputs(
                              prev => ({
                                ...prev,
                                [p.id]: e.target.value
                              })
                            )}
                            style={{
                              flex: 1,
                              background: 'rgba(255,255,255,0.04)',
                              border: '1px solid rgba(255,255,255,0.1)',
                              borderRadius: 8,
                              padding: '8px 12px',
                              fontSize: 12,
                              color: '#fff',
                              fontFamily: 'monospace',
                              outline: 'none',
                            }}
                            onFocus={e => {
                              e.currentTarget.style.borderColor
                                = accent
                            }}
                            onBlur={e => {
                              e.currentTarget.style.borderColor
                                = 'rgba(255,255,255,0.1)'
                            }}
                          />
                          <button
                            onClick={() => saveKey(p.id)}
                            disabled={!keyInputs[p.id]}
                            style={{
                              padding: '8px 16px',
                              background: keyInputs[p.id]
                                ? accent : 'transparent',
                              color: keyInputs[p.id]
                                ? '#000'
                                : 'rgba(255,255,255,0.25)',
                              border: `1px solid ${keyInputs[p.id]
                                ? 'transparent'
                                : 'rgba(255,255,255,0.1)'}`,
                              borderRadius: 8,
                              fontSize: 11, fontWeight: 700,
                              cursor: keyInputs[p.id]
                                ? 'pointer' : 'not-allowed',
                              transition: 'all 0.15s',
                              flexShrink: 0,
                            }}
                          >
                            Save
                          </button>
                          {isConfigured && (
                            <button
                              onClick={() => deleteKey(p.id)}
                              style={{
                                padding: '8px 12px',
                                background: 'transparent',
                                border: '1px solid rgba(239,68,68,0.2)',
                                borderRadius: 8,
                                color: 'rgba(239,68,68,0.6)',
                                cursor: 'pointer',
                                flexShrink: 0,
                                transition: 'all 0.15s',
                                display: 'flex',
                                alignItems: 'center',
                              }}
                              onMouseEnter={e => {
                                e.currentTarget.style.borderColor
                                  = '#ef4444'
                                e.currentTarget.style.color
                                  = '#ef4444'
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.borderColor
                                  = 'rgba(239,68,68,0.2)'
                                e.currentTarget.style.color
                                  = 'rgba(239,68,68,0.6)'
                              }}
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'workspace' && project && (
          <div className="page-enter">
            <h3 style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.03em', textTransform: 'none', color: 'rgba(255,255,255,0.35)', marginBottom: 24 }}>
              Workspace
            </h3>

            <div style={{ marginBottom: 24 }}>
              <div style={{
                fontSize: 9, fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.35)',
                marginBottom: 6,
              }}>
                Project Name
              </div>
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
              <div style={{
                fontSize: 9, fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.35)',
                marginBottom: 6,
              }}>
                Project Type
              </div>
              <input 
                type="text" 
                value={project.type}
                onChange={(e) => setProject({ ...project, type: e.target.value })}
                style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: '#fff', outline: 'none' }}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <div style={{
                fontSize: 9, fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.35)',
                marginBottom: 6,
              }}>
                Cluster Assignment
              </div>
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

            <div style={{
              marginTop: 32,
              border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: 12, padding: '20px 24px',
              background: 'rgba(239,68,68,0.04)',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center',
                gap: 8, marginBottom: 8,
              }}>
                <span style={{
                  color: '#ef4444', fontSize: 16,
                }}>⚠</span>
                <span style={{
                  fontSize: 13, fontWeight: 700,
                  color: '#ef4444',
                }}>
                  Danger Zone
                </span>
              </div>
              <p style={{
                fontSize: 13,
                color: 'rgba(255,255,255,0.4)',
                lineHeight: 1.6, marginBottom: 16,
              }}>
                Deleting this project will permanently 
                purge all archived metadata, feature 
                specs, and context engine versions. 
                This action is irreversible and cannot 
                be undone.
              </p>
              <button
                onClick={() => {
                  if (confirm('Delete this project? This cannot be undone.')) {
                    handleDeleteProject()
                  }
                }}
                style={{
                  padding: '8px 20px',
                  border: '1px solid #ef4444',
                  borderRadius: 8,
                  background: 'transparent',
                  color: '#ef4444',
                  fontSize: 11, fontWeight: 800,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background =
                    'rgba(239,68,68,0.1)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background =
                    'transparent'
                }}
              >
                Delete Project
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
