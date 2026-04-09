'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { 
  Trash2,
  AlertTriangle,
} from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import { toast } from 'sonner'
import { ThemeSwitcher } from '@/components/theme-switcher'
import type { User as SupabaseUser } from '@supabase/supabase-js'

function hexToRgba(hex: string, a: number) {
  if (!hex || hex.length < 7) return `rgba(255,255,255,${a})`
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

interface Project {
  id:                 string
  name:               string
  type:               string
  cluster:            string
  repo_url:           string | null
  editor_preference:  string
  git_branch:         string | null
  git_last_commit:    string | null
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
  const [showDeleteConfirm,  setShowDeleteConfirm]  = useState(false)
  const [isDeletingProject,  setIsDeletingProject]  = useState(false)

  // Subscription state
  const [cancelling, setCancelling] = useState(false)
  const [cancelConfirm, setCancelConfirm] = useState(false)
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>('active')
  const [subId,              setSubId]              = useState<string | null>(null)

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
          .select('plan, status, stripe_subscription_id')
          .eq('user_id', authUser.user.id)
          .single()

        if (planData) {
          setUserPlan(planData.plan as 'free' | 'pro')
          setSubscriptionStatus(planData.status ?? 'active')
          setSubId(planData.stripe_subscription_id ?? null)
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
          name:              project.name,
          type:              project.type,
          cluster:           project.cluster,
          repo_url:          project.repo_url ?? null,
          editor_preference: project.editor_preference ?? 'generic',
        })
        .eq('id', projectId)
      if (error) throw error
      toast.success('Project configuration updated')
    } catch {
      toast.error('Update failed')
    }
  }

  const handleDeleteProject = async () => {
    setIsDeletingProject(true)
    try {
      const { error } = await supabase.from('projects').delete().eq('id', projectId)
      if (error) throw error
      toast.success('Project deleted')
      router.push('/dashboard')
    } catch {
      toast.error('Delete failed')
      setIsDeletingProject(false)
      setShowDeleteConfirm(false)
    }
  }

  const handleCancelSubscription = async () => {
    if (cancelling) return
    setCancelling(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/stripe/cancel', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      const data = await res.json()
      if (data.ok) {
        toast.success('Subscription cancelled — you keep Pro until the end of your billing period.')
        setSubscriptionStatus('cancelled')
        setCancelConfirm(false)
      } else {
        toast.error(data.error || 'Cancellation failed')
      }
    } catch {
      toast.error('Cancellation failed')
    }
    setCancelling(false)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) return <div style={{ padding: 48, background: '#07070f', color: '#fff' }} className="page-enter">Calibrating Settings...</div>

  return (
    <div style={{
      minHeight: '100vh',
      background: '#05050f',
      paddingBottom: 80,
    }}>
      <div style={{ maxWidth: 840, margin: '0 auto', padding: isMobile ? '32px 20px' : '64px 32px' }} className="page-enter">
      <title>{`Settings — ${project?.name}`}</title>
      
      <div style={{ marginBottom: 48 }}>
        <div style={{
          fontSize: 9, fontWeight: 800,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: accent, marginBottom: 8,
        }}>
          Project Configuration
        </div>
        <h1 style={{
          fontSize: 32, fontWeight: 900,
          color: '#fff', letterSpacing: '-0.03em',
          marginBottom: 8, lineHeight: 1,
        }}>
          Settings
        </h1>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>
          Configure your project and workspace preferences.
        </p>
      </div>

      {/* TAB NAVIGATION */}
      <div style={{
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        marginBottom: 32,
        display: 'flex', gap: 0,
        overflowX: 'auto',
        padding: '0 4px',
      }} className="hide-scrollbar">
        {[
          { id: 'workspace', label: 'Workspace' },
          { id: 'subscription', label: 'Subscription' },
          { id: 'models', label: 'Models' },
          { id: 'aesthetics', label: 'Aesthetics' },
          { id: 'advanced', label: 'Advanced' }
        ].map(t => {
          const isActive = activeTab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                padding: '12px 0',
                marginRight: 24,
                background: 'transparent',
                border: 'none',
                borderBottom: isActive ? `2px solid ${accent}` : '2px solid transparent',
                color: isActive ? '#fff' : 'rgba(255,255,255,0.4)',
                fontSize: 13, fontWeight: isActive ? 700 : 400,
                cursor: 'pointer',
                transition: 'all 0.15s',
                marginBottom: -1,
                minWidth: 'max-content'
              }}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      {/* TAB CONTENT */}
      <div>
        {activeTab === 'aesthetics' && (
          <div className="page-enter">
            <div style={{
              background: 'rgba(255,255,255,0.025)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 18,
              padding: '24px 28px',
              marginBottom: 16,
            }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 16 }}>
                Accent theme
              </h3>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', lineHeight: 1.7, marginBottom: 20 }}>
                Personalize the visual identity of your project dashboard.
              </p>
              <ThemeSwitcher />
            </div>
          </div>
        )}

        {activeTab === 'models' && (
          <div className="page-enter">
            <div style={{
              background: 'rgba(255,255,255,0.025)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 18,
              padding: '24px 28px',
              marginBottom: 16,
            }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 16 }}>
                API Key Configuration
              </h3>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', lineHeight: 1.7, marginBottom: 24 }}>
                Connect your AI providers to enable model routing and context injection.
              </p>

              {userPlan !== 'pro' ? (
                <div style={{
                  border: `1px solid ${hexToRgba(accent, 0.25)}`,
                  borderRadius: 16,
                  padding: '32px 28px',
                  background: hexToRgba(accent, 0.05),
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: 32, marginBottom: 14 }}>🔒</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 8 }}>BYOK is a Pro feature</div>
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', lineHeight: 1.65, marginBottom: 24, maxWidth: 380, margin: '0 auto 24px' }}>
                    Bring Your Own Key (BYOK) lets you use your personal API keys for Anthropic, OpenRouter, Mistral, and more.
                  </p>
                  <button
                    onClick={() => window.location.href = '/upgrade'}
                    style={{
                      padding: '10px 24px', background: accent, color: '#000',
                      border: 'none', borderRadius: 999, fontSize: 12, fontWeight: 800,
                      textTransform: 'uppercase', cursor: 'pointer',
                    }}
                  >
                    Upgrade to Pro
                  </button>
                </div>
              ) : (
                <div>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    marginBottom: 20, padding: '11px 16px',
                    background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)',
                    borderRadius: 12,
                  }}>
                    <span style={{ color: '#34d399', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>Configured</span>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                      Your own keys have no usage limits.
                    </span>
                  </div>
                  {PROVIDERS.map(p => {
                    const isConfigured = configuredProviders.includes(p.id)
                    return (
                      <div
                        key={p.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '14px 0',
                          borderBottom: '1px solid rgba(255,255,255,0.05)',
                        }}
                      >
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.6)', minWidth: 90 }}>
                          {p.name}
                        </div>
                        <div style={{ flex: 1, display: 'flex', gap: 8 }}>
                          <input
                            type="password"
                            placeholder={isConfigured ? '••••••••••••••••' : p.placeholder}
                            value={keyInputs[p.id] || ''}
                            onChange={e => setKeyInputs(prev => ({ ...prev, [p.id]: e.target.value }))}
                            style={{
                              flex: 1, background: 'rgba(255,255,255,0.04)',
                              border: '1px solid rgba(255,255,255,0.09)', borderRadius: 12,
                              padding: '11px 14px', fontSize: 13, color: '#fff',
                              fontFamily: 'monospace', outline: 'none',
                              transition: 'border-color 0.2s',
                            }}
                            onFocus={e => e.currentTarget.style.borderColor = accent}
                            onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'}
                          />
                          <button
                            onClick={() => saveKey(p.id)}
                            disabled={!keyInputs[p.id]}
                            style={{
                              padding: '8px 16px',
                              background: keyInputs[p.id] ? accent : 'rgba(255,255,255,0.04)',
                              color: keyInputs[p.id] ? '#000' : 'rgba(255,255,255,0.2)',
                              border: keyInputs[p.id] ? 'none' : '1px solid rgba(255,255,255,0.09)',
                              borderRadius: 10, fontSize: 11, fontWeight: 700,
                              cursor: keyInputs[p.id] ? 'pointer' : 'not-allowed',
                            }}
                          >
                            Save
                          </button>
                          {isConfigured && (
                            <button
                              onClick={() => deleteKey(p.id)}
                              style={{
                                padding: '8px 12px', background: 'rgba(248,113,113,0.05)',
                                border: '1px solid rgba(248,113,113,0.2)', borderRadius: 10,
                                color: 'rgba(248,113,113,0.6)', cursor: 'pointer',
                              }}
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}
        {activeTab === 'subscription' && (
          <div className="page-enter" style={{ maxWidth: 480 }}>
            <div style={{
              background: 'rgba(255,255,255,0.025)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 18,
              padding: '24px 28px',
              marginBottom: 16,
            }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 16 }}>
                Subscription
              </h3>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 24, lineHeight: 1.6 }}>
                {userPlan === 'pro' && subscriptionStatus === 'cancelled'
                  ? 'Your subscription is cancelled. Pro access continues until the end of your billing period.'
                  : userPlan === 'pro'
                  ? 'You\'re on the Pro plan.'
                  : 'You\'re on the Free plan.'}
              </p>

              <div style={{
                padding: '16px 20px',
                background: userPlan === 'pro' ? hexToRgba(accent, 0.06) : 'rgba(255,255,255,0.03)',
                border: `1px solid ${userPlan === 'pro' ? hexToRgba(accent, 0.2) : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 14,
                marginBottom: 20,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>
                      {userPlan === 'pro' ? 'Pro' : 'Free'}
                    </div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 3 }}>
                      {userPlan === 'pro'
                        ? subscriptionStatus === 'cancelled'
                          ? 'Cancelled — active until period end'
                          : 'Active subscription'
                        : '2 projects · 50 coins/day'}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 800, padding: '4px 10px',
                    borderRadius: 999,
                    background: userPlan === 'pro' ? hexToRgba(accent, 0.15) : 'rgba(255,255,255,0.06)',
                    color: userPlan === 'pro' ? accent : 'rgba(255,255,255,0.4)',
                    border: `1px solid ${userPlan === 'pro' ? hexToRgba(accent, 0.3) : 'rgba(255,255,255,0.1)'}`,
                  }}>
                    {userPlan === 'pro' ? 'PRO' : 'FREE'}
                  </span>
                </div>
              </div>

              {userPlan === 'free' && (
                <a
                  href="/upgrade"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '11px 24px',
                    background: accent, color: '#000',
                    borderRadius: 10, fontSize: 13, fontWeight: 800,
                    textDecoration: 'none',
                    boxShadow: `0 0 20px ${hexToRgba(accent, 0.3)}`,
                  }}
                >
                  Upgrade to Pro →
                </a>
              )}

              {userPlan === 'pro' && subscriptionStatus !== 'cancelled' && (
                !cancelConfirm ? (
                  <button
                    onClick={() => setCancelConfirm(true)}
                    style={{
                      padding: '10px 20px',
                      background: 'rgba(248,113,113,0.08)',
                      border: '1px solid rgba(248,113,113,0.2)',
                      borderRadius: 10, fontSize: 13, fontWeight: 600,
                      color: '#f87171', cursor: 'pointer',
                    }}
                  >
                    Cancel subscription
                  </button>
                ) : (
                  <div style={{
                    padding: '16px', background: 'rgba(248,113,113,0.06)',
                    border: '1px solid rgba(248,113,113,0.2)', borderRadius: 12,
                  }}>
                    <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 14, lineHeight: 1.6 }}>
                      Are you sure? You&apos;ll keep Pro access until the end of your current billing period,
                      then revert to Free.
                    </p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => setCancelConfirm(false)}
                        style={{
                          padding: '8px 16px', background: 'rgba(255,255,255,0.06)',
                          border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
                          fontSize: 12, fontWeight: 600, color: '#fff', cursor: 'pointer',
                        }}
                      >
                        Keep Pro
                      </button>
                      <button
                        onClick={handleCancelSubscription}
                        disabled={cancelling}
                        style={{
                          padding: '8px 16px',
                          background: cancelling ? 'rgba(248,113,113,0.3)' : '#f87171',
                          border: 'none', borderRadius: 8,
                          fontSize: 12, fontWeight: 800,
                          color: '#000', cursor: cancelling ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {cancelling ? 'Cancelling…' : 'Yes, cancel'}
                      </button>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        )}

        {activeTab === 'workspace' && project && (
          <div className="page-enter">
            <div style={{
              background: 'rgba(255,255,255,0.025)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 18,
              padding: '24px 28px',
              marginBottom: 16,
            }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 16 }}>
                Workspace info
              </h3>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', lineHeight: 1.7, marginBottom: 24 }}>
                Global metadata for your project and blueprint identification.
              </p>

              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>
                  Project Name
                </div>
                <input 
                  type="text" 
                  value={project.name}
                  onChange={(e) => setProject({ ...project, name: e.target.value })}
                  style={{
                    width: '100%', background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.09)', borderRadius: 12,
                    padding: '11px 14px', fontSize: 13, color: '#fff', outline: 'none',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = accent}
                  onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'}
                />
              </div>

              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>
                  Project Type
                </div>
                <input 
                  type="text" 
                  value={project.type}
                  onChange={(e) => setProject({ ...project, type: e.target.value })}
                  style={{
                    width: '100%', background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.09)', borderRadius: 12,
                    padding: '11px 14px', fontSize: 13, color: '#fff', outline: 'none',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = accent}
                  onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'}
                />
              </div>

              <div style={{ marginBottom: 0 }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>
                  Repository URL
                </div>
                <input
                  type="url"
                  placeholder="https://github.com/username/repo"
                  value={project.repo_url ?? ''}
                  onChange={(e) => setProject({ ...project, repo_url: e.target.value || null })}
                  style={{
                    width: '100%', background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.09)', borderRadius: 12,
                    padding: '11px 14px', fontSize: 13, color: '#fff', outline: 'none',
                    fontFamily: 'monospace', transition: 'border-color 0.2s',
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = accent}
                  onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'}
                />
              </div>
            </div>

            <div style={{
              background: 'rgba(255,255,255,0.025)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 18,
              padding: '24px 28px',
              marginBottom: 16,
            }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 16 }}>
                AI Coding Editor
              </h3>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', lineHeight: 1.7, marginBottom: 20 }}>
                Select your preferred IDE to optimize context file generation.
              </p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {[
                  { value: 'cursor',     label: 'Cursor',         file: '.cursorrules' },
                  { value: 'claude-code',label: 'Claude Code',    file: 'CLAUDE.md' },
                  { value: 'copilot',    label: 'Copilot',        file: 'copilot-instructions.md' },
                  { value: 'windsurf',   label: 'Windsurf',       file: '.windsurfrules' },
                  { value: 'generic',    label: 'Other / None',   file: 'reminisce-context.md' },
                ].map(opt => {
                  const isActive = (project.editor_preference ?? 'generic') === opt.value
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setProject({ ...project, editor_preference: opt.value })}
                      style={{
                        padding: '10px 18px',
                        borderRadius: 12,
                        background: isActive ? hexToRgba(accent, 0.12) : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${isActive ? hexToRgba(accent, 0.3) : 'rgba(255,255,255,0.09)'}`,
                        color: isActive ? accent : 'rgba(255,255,255,0.5)',
                        fontSize: 12, fontWeight: 600,
                        cursor: 'pointer', transition: 'all 0.15s',
                        textAlign: 'left',
                      }}
                    >
                      <div style={{ fontWeight: 800 }}>{opt.label}</div>
                      <div style={{ fontSize: 9, opacity: 0.5, marginTop: 2 }}>{opt.file}</div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 40 }}>
              <button
                onClick={handleUpdateProject}
                style={{
                  background: accent, color: '#000', border: 'none', borderRadius: 999,
                  padding: '12px 32px', fontSize: 12, fontWeight: 800,
                  boxShadow: `0 8px 24px ${hexToRgba(accent, 0.2)}`,
                  cursor: 'pointer',
                }}
              >
                Save Changes
              </button>
            </div>

            <div style={{
              background: 'rgba(248,113,113,0.04)',
              border: '1px solid rgba(248,113,113,0.15)',
              borderRadius: 18,
              padding: '24px 28px',
            }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: '#f87171', marginBottom: 12 }}>
                Danger Zone
              </h3>
              <p style={{ fontSize: 13, color: 'rgba(248,113,113,0.5)', lineHeight: 1.7, marginBottom: 20 }}>
                Deleting this project will permanently purge all archived metadata. This action is irreversible.
              </p>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                style={{
                  background: 'rgba(248,113,113,0.1)',
                  border: '1px solid rgba(248,113,113,0.3)',
                  color: '#f87171',
                  borderRadius: 10, padding: '10px 20px',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}
              >
                Delete Project
              </button>
            </div>
          </div>
        )}


        {activeTab === 'advanced' && user && (
          <div className="page-enter">
            <div style={{
              background: 'rgba(255,255,255,0.025)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 18,
              padding: '24px 28px',
              marginBottom: 16,
            }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 16 }}>
                Advanced
              </h3>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', lineHeight: 1.7, marginBottom: 24 }}>
                System-level attributes and session management.
              </p>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '14px 0', gap: 16 }}>
                <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', flexShrink: 0, letterSpacing: '0.08em' }}>EMAIL</span>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', fontFamily: 'monospace' }}>{user.email}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '14px 0', gap: 16 }}>
                <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', flexShrink: 0, letterSpacing: '0.08em' }}>USER ID</span>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', fontFamily: 'monospace' }}>{user.id.slice(0, 16)}...</span>
              </div>
              <button 
                onClick={handleSignOut}
                style={{
                  marginTop: 32, border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)',
                  background: 'transparent', borderRadius: 10, padding: '10px 24px', 
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'; e.currentTarget.style.color = '#fff' }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'rgba(255,255,255,0.5)' }}
              >
                Sign out
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Delete project confirm modal ── */}
      {showDeleteConfirm && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          zIndex: 9999,
          display: 'flex', alignItems: 'center',
          justifyContent: 'center', padding: 24,
        }}>
          <div style={{
            background: 'rgba(10,10,24,0.98)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 24, padding: '32px',
            maxWidth: 440, width: '100%',
            boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <AlertTriangle size={20} color="#f87171"/>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>
                Delete project permanently?
              </div>
            </div>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', lineHeight: 1.7, marginBottom: 20 }}>
              This will permanently delete <strong style={{ color: '#fff' }}>{project?.name}</strong> including all blueprint data, prompts, and history.
            </p>
            <div style={{ fontSize: 12, color: '#f87171', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 10, padding: '12px', marginBottom: 28 }}>
              This action cannot be undone.
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeletingProject}
                style={{ padding: '10px 20px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.6)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteProject}
                disabled={isDeletingProject}
                style={{ padding: '10px 20px', background: '#ef4444', border: 'none', borderRadius: 12, cursor: 'pointer', fontSize: 13, fontWeight: 800, color: '#fff' }}
              >
                {isDeletingProject ? 'Deleting...' : 'Delete project'}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
