'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/hooks/useTheme'
import { useIsMobile } from '@/hooks/useMediaQuery'
import {
  Users, Zap, BarChart2, ShieldAlert, LogOut, Star,
  RefreshCw, Plus, Edit2, Trash2, Ban, Crown, Search,
  ChevronLeft, ChevronRight, TrendingUp, Activity,
  Database, MessageSquare, Wand2, Bot, Coins,
  CheckCircle, XCircle, Clock, Eye, AlertTriangle,
} from 'lucide-react'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hexToRgba(hex: string, a: number) {
  if (!hex || hex.length < 7) return `rgba(245,158,11,${a})`
  const r = parseInt(hex.slice(1,3),16)
  const g = parseInt(hex.slice(3,5),16)
  const b = parseInt(hex.slice(5,7),16)
  return `rgba(${r},${g},${b},${a})`
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '—'
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function pill(color: string, text: string) {
  return { color, bg: hexToRgba(color, 0.1), border: hexToRgba(color, 0.25), text }
}

const STATUS_PILL: Record<string, ReturnType<typeof pill>> = {
  pro:        pill('#f59e0b', 'Pro'),
  free:       pill('#94a3b8', 'Free'),
  active:     pill('#34d399', 'Active'),
  banned:     pill('#f87171', 'Banned'),
  admin:      pill('#a78bfa', 'Admin'),
  enabled:    pill('#34d399', 'On'),
  disabled:   pill('#f87171', 'Off'),
}

function Pill({ type, custom }: { type?: keyof typeof STATUS_PILL; custom?: ReturnType<typeof pill> }) {
  const p = custom ?? STATUS_PILL[type ?? 'free']
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700,
      background: p.bg, border: `1px solid ${p.border}`, color: p.color,
      whiteSpace: 'nowrap',
    }}>
      {p.text}
    </span>
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Stats {
  users: { total: number; pro: number; free: number; banned: number; newToday: number }
  projects: { total: number; active: number }
  economy: { totalCoins: number; totalGems: number; transactionsToday: number }
  activity: { agentRunsToday: number; pamMessagesToday: number; wizardSessionsToday: number }
  recentSignups: Array<{ user_id: string; plan: string; created_at: string }>
  recentTransactions: Array<{ type: string; amount: number; currency: string; description: string; created_at: string }>
}

interface AdminUser {
  id: string
  email: string
  created_at: string
  last_sign_in: string | null
  plan: string
  is_admin: boolean
  banned_at: string | null
  ban_reason: string | null
  projects_limit: number
  coins: number
  gems: number
  project_count?: number
}

interface Model {
  id: string
  provider: string
  model_id: string
  label: string
  model_name: string
  is_free: boolean
  enabled: boolean
  tier_required: string
  cost_coins: number | null
  cost_gems: number | null
  context_window: number | null
  sort_order: number
  notes: string | null
}

interface AuditLog {
  id: string
  admin_id: string
  action: string
  target_id: string | null
  target_type: string | null
  payload: Record<string, unknown>
  created_at: string
}

// ─── Modal shell ──────────────────────────────────────────────────────────────

function Modal({ title, onClose, children, width = 480 }: {
  title: string; onClose: () => void
  children: React.ReactNode; width?: number
}) {
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)', zIndex: 200 }}/>
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%,-50%)',
        width, maxWidth: 'calc(100vw - 32px)', maxHeight: '90vh', overflowY: 'auto',
        background: 'rgba(8,8,22,0.99)', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 18, padding: 28, zIndex: 201,
        boxShadow: '0 40px 100px rgba(0,0,0,0.9)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{title}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: 20, lineHeight: 1 }}>✕</button>
        </div>
        {children}
      </div>
    </>
  )
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, color, trend }: {
  icon: React.ElementType; label: string; value: string | number
  sub?: string; color?: string; trend?: number
}) {
  const c = color ?? '#f59e0b'
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 14, padding: '16px 18px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: hexToRgba(c, 0.1), border: `1px solid ${hexToRgba(c, 0.2)}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={14} color={c}/>
        </div>
        {trend !== undefined && (
          <span style={{ fontSize: 10, fontWeight: 700, color: trend >= 0 ? '#34d399' : '#f87171' }}>
            {trend >= 0 ? '+' : ''}{trend} today
          </span>
        )}
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1 }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{label}</span>
        {sub && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>{sub}</span>}
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'users' | 'models' | 'activity' | 'logs'

export default function AdminPage() {
  const { accent } = useTheme()
  const ac = accent || '#f59e0b'
  const router = useRouter()
  const isMobile = useIsMobile()

  const [tab,        setTab]        = useState<Tab>('overview')
  const [token,      setToken]      = useState<string | null>(null)
  const [stats,      setStats]      = useState<Stats | null>(null)
  const [users,      setUsers]      = useState<AdminUser[]>([])
  const [models,     setModels]     = useState<Model[]>([])
  const [logs,       setLogs]       = useState<AuditLog[]>([])
  const [userSearch, setUserSearch] = useState('')
  const [userPage,   setUserPage]   = useState(0)
  const [userTotal,  setUserTotal]  = useState(0)
  const [loading,    setLoading]    = useState(false)

  // Modals
  const [banModal,      setBanModal]      = useState<AdminUser | null>(null)
  const [banReason,     setBanReason]     = useState('')
  const [walletModal,   setWalletModal]   = useState<AdminUser | null>(null)
  const [walletCoins,   setWalletCoins]   = useState(0)
  const [walletGems,    setWalletGems]    = useState(0)
  const [modelModal,    setModelModal]    = useState<Partial<Model> | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'user' | 'model'; id: string; label: string } | null>(null)
  const [viewUser,      setViewUser]      = useState<AdminUser | null>(null)
  const [viewUserActivity, setViewUserActivity] = useState<Array<{
    type: string; amount: number; currency: string; description: string; created_at: string
  }>>([])

  const searchTimeout = useRef<ReturnType<typeof setTimeout>>()

  // ── Auth ─────────────────────────────────────────────────────────────────────

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setToken(session.access_token)
    })
  }, [])

  const headers = useCallback((): HeadersInit => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token ?? ''}`,
  }), [token])

  // ── Data fetchers ────────────────────────────────────────────────────────────

  const loadStats = useCallback(async () => {
    if (!token) return
    const res = await fetch('/api/admin/stats', { headers: headers() })
    const data = await res.json()
    if (!data.error) setStats(data)
  }, [token, headers])

  const loadUsers = useCallback(async () => {
    if (!token) return
    setLoading(true)
    const res = await fetch(
      `/api/admin/users?page=${userPage}&search=${encodeURIComponent(userSearch)}`,
      { headers: headers() }
    )
    const data = await res.json()
    setUsers(data.users ?? [])
    setUserTotal(data.total ?? 0)
    setLoading(false)
  }, [token, userPage, userSearch, headers])

  const loadModels = useCallback(async () => {
    if (!token) return
    const res = await fetch('/api/admin/models', { headers: headers() })
    const data = await res.json()
    setModels(data.models ?? [])
  }, [token, headers])

  const loadLogs = useCallback(async () => {
    if (!token) return
    const res = await fetch('/api/admin/logs', { headers: headers() })
    const data = await res.json()
    setLogs(data.logs ?? [])
  }, [token, headers])

  useEffect(() => { if (token) { loadStats(); loadModels() } }, [token, loadStats, loadModels])
  useEffect(() => { if (token && tab === 'users') loadUsers() }, [token, tab, userPage, loadUsers])
  useEffect(() => { if (token && tab === 'logs')  loadLogs()  }, [token, tab, loadLogs])
  useEffect(() => { if (token && tab === 'activity') loadStats() }, [token, tab, loadStats])

  // When viewUser changes, fetch their recent transactions
  useEffect(() => {
    if (!viewUser || !token) { setViewUserActivity([]); return }
    fetch(`/api/admin/users/${viewUser.id}/activity`, { headers: headers() })
      .then(r => r.json())
      .then(d => setViewUserActivity(d.transactions ?? []))
      .catch(() => setViewUserActivity([]))
  }, [viewUser, token, headers])

  // ── Debounced search ─────────────────────────────────────────────────────────

  const handleSearchChange = (v: string) => {
    setUserSearch(v)
    setUserPage(0)
    clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => loadUsers(), 400)
  }

  // ── Actions ──────────────────────────────────────────────────────────────────

  const userAction = async (userId: string, action: string, extra?: Record<string, unknown>) => {
    await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH', headers: headers(),
      body: JSON.stringify({ action, ...extra }),
    })
    loadUsers(); loadStats()
  }

  const deleteUser = async (userId: string) => {
    await fetch(`/api/admin/users/${userId}`, { method: 'DELETE', headers: headers() })
    setConfirmDelete(null); loadUsers(); loadStats()
  }

  const saveModel = async () => {
    if (!modelModal) return
    if (modelModal.id) {
      await fetch(`/api/admin/models/${modelModal.id}`, {
        method: 'PATCH', headers: headers(), body: JSON.stringify(modelModal),
      })
    } else {
      await fetch('/api/admin/models', {
        method: 'POST', headers: headers(), body: JSON.stringify(modelModal),
      })
    }
    setModelModal(null); loadModels()
  }

  const toggleModel = async (m: Model) => {
    await fetch(`/api/admin/models/${m.id}`, {
      method: 'PATCH', headers: headers(),
      body: JSON.stringify({ enabled: !m.enabled }),
    })
    loadModels()
  }

  const deleteModel = async (id: string) => {
    await fetch(`/api/admin/models/${id}`, { method: 'DELETE', headers: headers() })
    setConfirmDelete(null); loadModels()
  }

  // ── Shared styles ─────────────────────────────────────────────────────────────

  const btn = (color = ac, ghost = false): React.CSSProperties => ({
    padding: '5px 12px', borderRadius: 7, border: ghost
      ? '1px solid rgba(255,255,255,0.1)'
      : `1px solid ${hexToRgba(color, 0.3)}`,
    background: ghost ? 'rgba(255,255,255,0.04)' : hexToRgba(color, 0.1),
    color: ghost ? 'rgba(255,255,255,0.55)' : color,
    cursor: 'pointer', fontSize: 11, fontWeight: 700,
    display: 'inline-flex', alignItems: 'center', gap: 5,
    transition: 'all 0.15s',
  })

  const th: React.CSSProperties = {
    fontSize: 11, fontWeight: 800, letterSpacing: '0.05em',
    color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase',
    padding: '10px 14px', background: 'rgba(255,255,255,0.04)',
  }

  const td: React.CSSProperties = {
    padding: '10px 14px', fontSize: 12,
    borderTop: '1px solid rgba(255,255,255,0.05)',
    color: 'rgba(255,255,255,0.8)', verticalAlign: 'middle',
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    padding: '9px 12px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none',
  }

  // ── Tab nav items ─────────────────────────────────────────────────────────────

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'overview',  label: 'Overview',   icon: BarChart2    },
    { id: 'users',     label: 'Users',      icon: Users        },
    { id: 'models',    label: 'AI Models',  icon: Zap          },
    { id: 'activity',  label: 'Activity',   icon: Activity     },
    { id: 'logs',      label: 'Audit Log',  icon: ShieldAlert  },
  ]

  const actionColor = (a: string) => {
    if (a.includes('delete') || a.includes('ban')) return '#f87171'
    if (a.includes('add') || a.includes('unban') || a.includes('pro')) return '#34d399'
    return ac
  }

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#07070f', color: '#fff', fontFamily: 'inherit', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <header style={{ height: 54, borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', padding: '0 20px', gap: 12, background: 'rgba(8,8,20,0.85)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 50, flexShrink: 0 }}>
        <Star size={13} fill={ac} stroke={ac}/>
        <span style={{ fontSize: 14, fontWeight: 700 }}>Reminisce</span>
        <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.12)' }}/>
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#f87171', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 999, padding: '2px 9px' }}>
          Admin Console
        </span>
        <div style={{ flex: 1 }}/>
        {stats && (
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
            <span>{stats.users.total.toLocaleString()} users</span>
            <span>{stats.projects.total.toLocaleString()} projects</span>
            <span style={{ color: ac }}>{stats.users.pro} pro</span>
          </div>
        )}
        <button onClick={() => router.push('/dashboard')} style={{ ...btn(undefined, true), marginLeft: 8 }}>
          <LogOut size={11}/> Dashboard
        </button>
      </header>

      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', flex: 1, minHeight: 0 }}>

        {/* Sidebar */}
        <aside style={{ 
          width: isMobile ? '100%' : 196, 
          borderRight: isMobile ? 'none' : '1px solid rgba(255,255,255,0.07)', 
          borderBottom: isMobile ? '1px solid rgba(255,255,255,0.07)' : 'none',
          padding: '12px 8px', 
          display: 'flex', 
          flexDirection: isMobile ? 'row' : 'column', 
          overflowX: isMobile ? 'auto' : 'visible',
          gap: 3, 
          flexShrink: 0, 
          background: 'rgba(8,8,20,0.4)',
          WebkitOverflowScrolling: 'touch'
        }}>
          {TABS.map(t => {
            const active = tab === t.id
            return (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                display: 'flex', alignItems: 'center', gap: 9,
                padding: '9px 12px', borderRadius: 9, border: 'none',
                background: active ? hexToRgba(ac, 0.1) : 'transparent',
                boxShadow: active ? `inset 0 0 0 1px ${hexToRgba(ac, 0.18)}` : 'none',
                color: active ? ac : 'rgba(255,255,255,0.42)',
                cursor: 'pointer', fontSize: 12, fontWeight: active ? 600 : 400,
                textAlign: 'left', width: '100%', transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (!active) { const el = e.currentTarget as HTMLElement; el.style.background='rgba(255,255,255,0.05)'; el.style.color='#fff' }}}
              onMouseLeave={e => { if (!active) { const el = e.currentTarget as HTMLElement; el.style.background='transparent'; el.style.color='rgba(255,255,255,0.42)' }}}
              >
                <t.icon size={14}/>
                {!isMobile && t.label}
              </button>
            )
          })}

          {/* Quick stats in sidebar */}
          {!isMobile && stats && (
            <div style={{ marginTop: 'auto', padding: '12px 8px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.2)', marginBottom: 4 }}>Live</div>
              {[
                { icon: Users,    val: stats.users.total,           label: 'Total users' },
                { icon: Crown,    val: stats.users.pro,             label: 'Pro users'   },
                { icon: Database, val: stats.projects.total,        label: 'Projects'    },
                { icon: Zap,      val: models.filter(m=>m.enabled).length, label: 'Active models' },
              ].map(s => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11 }}>
                  <span style={{ color: 'rgba(255,255,255,0.35)', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <s.icon size={11}/>{s.label}
                  </span>
                  <span style={{ fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>{s.val}</span>
                </div>
              ))}
            </div>
          )}
        </aside>

        {/* Main */}
        <main style={{ flex: 1, overflow: 'auto', padding: 24 }}>

          {/* ════ OVERVIEW ════ */}
          {tab === 'overview' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Platform Overview</h1>
                <button onClick={loadStats} style={btn(undefined, true)}><RefreshCw size={11}/> Refresh</button>
              </div>

              {stats ? (
                <>
                  {/* Row 1 — Users */}
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4,1fr)', gap: 10, marginBottom: 10 }}>
                    <StatCard icon={Users}     label="Total users"     value={stats.users.total}     color="#60a5fa" trend={stats.users.newToday}/>
                    <StatCard icon={Crown}     label="Pro subscribers" value={stats.users.pro}       color={ac}     sub={`${stats.users.free} free`}/>
                    <StatCard icon={Ban}       label="Banned"          value={stats.users.banned}    color="#f87171"/>
                    <StatCard icon={Database}  label="Projects"        value={stats.projects.total}  color="#34d399" sub={`${stats.projects.active} active`}/>
                  </div>
                  {/* Row 2 — Economy */}
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4,1fr)', gap: 10, marginBottom: 10 }}>
                    <StatCard icon={Coins}       label="Coins in circulation" value={stats.economy.totalCoins}          color="#f59e0b"/>
                    <StatCard icon={Zap}         label="Gems in circulation"  value={stats.economy.totalGems}           color="#a78bfa"/>
                    <StatCard icon={TrendingUp}  label="Transactions today"   value={stats.economy.transactionsToday}   color="#34d399"/>
                    <StatCard icon={Activity}    label="Agent runs today"     value={stats.activity.agentRunsToday}     color="#60a5fa"/>
                  </div>
                  {/* Row 3 — Activity */}
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: 10, marginBottom: 20 }}>
                    <StatCard icon={MessageSquare} label="PAM messages today"   value={stats.activity.pamMessagesToday}    color="#a78bfa"/>
                    <StatCard icon={Wand2}         label="Wizard sessions today" value={stats.activity.wizardSessionsToday} color="#34d399"/>
                    <StatCard icon={Bot}           label="Models active"         value={models.filter(m=>m.enabled).length} color={ac} sub={`${models.length} total`}/>
                  </div>

                  {/* Recent signups */}
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
                    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 16, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Recent signups</div>
                      {(stats.recentSignups ?? []).slice(0,6).map((s,i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 11 }}>
                          <span style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', fontSize: 10 }}>{s.user_id.slice(0,20)}…</span>
                          <Pill type={s.plan === 'pro' ? 'pro' : 'free'}/>
                          <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10 }}>{timeAgo(s.created_at)}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 16, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Recent transactions</div>
                      {(stats.recentTransactions ?? []).slice(0,6).map((t,i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 11 }}>
                          <span style={{ color: t.type === 'credit' ? '#34d399' : '#f87171', fontWeight: 600 }}>
                            {t.type === 'credit' ? '+' : '−'}{t.amount} {t.currency}
                          </span>
                          <span style={{ color: 'rgba(255,255,255,0.35)', flex: 1, marginLeft: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description}</span>
                          <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10, marginLeft: 8 }}>{timeAgo(t.created_at)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,0.3)' }}>Loading stats…</div>
              )}
            </div>
          )}

          {/* ════ USERS ════ */}
          {tab === 'users' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0, flex: 1 }}>Users</h1>
                <div style={{ position: 'relative' }}>
                  <Search size={12} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }}/>
                  <input
                    value={userSearch}
                    onChange={e => handleSearchChange(e.target.value)}
                    placeholder="Search email or ID…"
                    style={{ ...inputStyle, paddingLeft: 28, height: 32, width: 220, fontSize: 12 }}
                  />
                </div>
                <button onClick={loadUsers} style={btn(undefined, true)}><RefreshCw size={11}/></button>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['User', 'Plan', 'Status', 'Wallet', 'Projects', 'Last active', 'Actions'].map(h => (
                        <th key={h} style={th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={7} style={{ ...td, textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>Loading…</td></tr>
                    ) : users.map(u => (
                      <tr key={u.id} style={{ background: u.banned_at ? 'rgba(248,113,113,0.04)' : 'transparent' }}>
                        <td style={td}>
                          <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200, color: u.banned_at ? '#f87171' : '#fff' }}>
                            {u.email}
                            {u.is_admin && <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 800, color: '#a78bfa' }}>ADMIN</span>}
                          </div>
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', fontFamily: 'monospace', marginTop: 2 }}>{u.id.slice(0,18)}…</div>
                        </td>
                        <td style={td}><Pill type={u.plan === 'pro' ? 'pro' : 'free'}/></td>
                        <td style={td}><Pill type={u.banned_at ? 'banned' : 'active'}/></td>
                        <td style={{ ...td, fontSize: 11 }}>
                          <div>🪙 {u.coins.toLocaleString()}</div>
                          <div>💎 {u.gems.toLocaleString()}</div>
                        </td>
                        <td style={{ ...td, textAlign: 'center' }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>{u.project_count ?? '—'}</span>
                        </td>
                        <td style={{ ...td, fontSize: 11, color: 'rgba(255,255,255,0.35)', whiteSpace: 'nowrap' }}>
                          {timeAgo(u.last_sign_in)}
                        </td>
                        <td style={td}>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            <button onClick={() => setViewUser(u)} style={btn('#60a5fa')}><Eye size={10}/></button>
                            <button
                              onClick={() => userAction(u.id, u.is_admin ? 'remove_admin' : 'make_admin')}
                              style={btn('#a78bfa')}
                            >
                              {u.is_admin ? '↓ Admin' : '↑ Admin'}
                            </button>
                            <button onClick={() => userAction(u.id, u.plan === 'pro' ? 'downgrade_free' : 'upgrade_pro')}
                              style={btn(ac)}>{u.plan === 'pro' ? '↓ Free' : '↑ Pro'}</button>
                            <button onClick={() => { setWalletModal(u); setWalletCoins(0); setWalletGems(0) }}
                              style={btn('#f59e0b')}><Coins size={10}/></button>
                            {u.banned_at
                              ? <button onClick={() => userAction(u.id, 'unban')} style={btn('#34d399')}><CheckCircle size={10}/></button>
                              : <button onClick={() => { setBanModal(u); setBanReason('') }} style={btn('#f87171')}><Ban size={10}/></button>
                            }
                            <button onClick={() => setConfirmDelete({ type: 'user', id: u.id, label: u.email ?? u.id })}
                              style={btn('#f87171')}><Trash2 size={10}/></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>{userTotal.toLocaleString()} users total</span>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <button onClick={() => setUserPage(p => Math.max(0, p-1))} disabled={userPage === 0} style={btn(undefined, true)}><ChevronLeft size={12}/></button>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Page {userPage + 1}</span>
                  <button onClick={() => setUserPage(p => p+1)} style={btn(undefined, true)}><ChevronRight size={12}/></button>
                </div>
              </div>
            </div>
          )}

          {/* ════ MODELS ════ */}
          {tab === 'models' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0, flex: 1 }}>AI Models</h1>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
                  {models.filter(m=>m.enabled).length} active / {models.length} total
                </span>
                <button onClick={() => setModelModal({ provider: '', model_id: '', label: '', is_free: true, enabled: true, tier_required: 'free', sort_order: models.length })}
                  style={btn(ac)}>
                  <Plus size={11}/> Add Model
                </button>
                <button onClick={loadModels} style={btn(undefined, true)}><RefreshCw size={11}/></button>
              </div>

              {/* Free tier section */}
              {['free','pro'].map(tier => {
                const tierModels = models.filter(m => m.tier_required === tier || (tier === 'free' && m.is_free) || (tier === 'pro' && !m.is_free))
                // deduplicate
                const seen = new Set<string>()
                const unique = tierModels.filter(m => { if (seen.has(m.id)) return false; seen.add(m.id); return true })
                return (
                  <div key={tier} style={{ marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <Pill custom={pill(tier === 'free' ? '#34d399' : ac, tier === 'free' ? 'Free Tier (🪙 Coins)' : 'Pro Tier (💎 Gems)')}/>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{unique.length} models</span>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr>
                            {['Model', 'Provider', 'Model ID', 'Context', 'Cost', 'Status', 'Actions'].map(h => <th key={h} style={th}>{h}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {unique.map(m => (
                            <tr key={m.id} style={{ opacity: m.enabled ? 1 : 0.5 }}>
                              <td style={td}>
                                <div style={{ fontWeight: 600, color: '#fff' }}>{m.label || m.model_name}</div>
                              </td>
                              <td style={{ ...td, fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{m.provider}</td>
                              <td style={{ ...td, fontSize: 11, fontFamily: 'monospace', color: 'rgba(255,255,255,0.4)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {m.model_id}
                              </td>
                              <td style={{ ...td, fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                                {m.context_window ? `${(m.context_window/1000).toFixed(0)}K` : '—'}
                              </td>
                              <td style={{ ...td, fontSize: 11 }}>
                                {m.is_free
                                  ? <span style={{ color: '#f59e0b' }}>🪙 {m.cost_coins ?? '?'}</span>
                                  : <span style={{ color: '#a78bfa' }}>💎 {m.cost_gems ?? '?'}</span>
                                }
                              </td>
                              <td style={td}>
                                <button onClick={() => toggleModel(m)} style={btn(m.enabled ? '#34d399' : '#f87171')}>
                                  {m.enabled ? <CheckCircle size={10}/> : <XCircle size={10}/>}
                                  {m.enabled ? ' On' : ' Off'}
                                </button>
                              </td>
                              <td style={td}>
                                <div style={{ display: 'flex', gap: 4 }}>
                                  <button onClick={() => setModelModal({...m})} style={btn(undefined, true)}><Edit2 size={10}/></button>
                                  <button onClick={() => setConfirmDelete({ type: 'model', id: m.id, label: m.label || m.model_id })}
                                    style={btn('#f87171')}><Trash2 size={10}/></button>
                                </div>
                              </td>
                            </tr>
                          ))}
                          {unique.length === 0 && (
                            <tr><td colSpan={7} style={{ ...td, textAlign: 'center', color: 'rgba(255,255,255,0.25)' }}>No {tier} tier models</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ════ ACTIVITY ════ */}
          {tab === 'activity' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Platform Activity</h1>
                <button onClick={loadStats} style={btn(undefined, true)}><RefreshCw size={11}/> Refresh</button>
              </div>

              {stats ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
                    <StatCard icon={Bot}           label="Agent runs today"      value={stats.activity.agentRunsToday}     color="#60a5fa"/>
                    <StatCard icon={MessageSquare} label="PAM messages today"    value={stats.activity.pamMessagesToday}    color="#a78bfa"/>
                    <StatCard icon={Wand2}         label="Wizard sessions today" value={stats.activity.wizardSessionsToday} color="#34d399"/>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
                    <StatCard icon={TrendingUp} label="Transactions today"     value={stats.economy.transactionsToday}  color="#f59e0b"/>
                    <StatCard icon={Users}      label="New users today"        value={stats.users.newToday}             color="#60a5fa"/>
                    <StatCard icon={Database}   label="Active projects"        value={stats.projects.active}            color="#34d399"/>
                  </div>

                  <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 20, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.35)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Recent platform transactions
                    </div>
                    {(stats.recentTransactions ?? []).map((t, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 12 }}>
                        <span style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: t.type === 'credit' ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)', color: t.type === 'credit' ? '#34d399' : '#f87171', fontWeight: 800, fontSize: 13 }}>
                          {t.type === 'credit' ? '+' : '−'}
                        </span>
                        <span style={{ fontWeight: 700, color: t.type === 'credit' ? '#34d399' : '#f87171', minWidth: 60 }}>
                          {t.amount} {t.currency}
                        </span>
                        <span style={{ flex: 1, color: 'rgba(255,255,255,0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.description}
                        </span>
                        <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11, whiteSpace: 'nowrap' }}>
                          {timeAgo(t.created_at)}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,0.3)' }}>Loading activity…</div>
              )}
            </div>
          )}

          {/* ════ AUDIT LOG ════ */}
          {tab === 'logs' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Audit Log</h1>
                <button onClick={loadLogs} style={btn(undefined, true)}><RefreshCw size={11}/></button>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>{['Time', 'Action', 'Target', 'Admin', 'Details'].map(h=><th key={h} style={th}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {logs.length === 0 ? (
                      <tr><td colSpan={5} style={{ ...td, textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>No admin actions logged yet.</td></tr>
                    ) : logs.map(log => (
                      <tr key={log.id}>
                        <td style={{ ...td, fontSize: 11, color: 'rgba(255,255,255,0.3)', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <Clock size={10}/>{timeAgo(log.created_at)}
                          </div>
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.18)', fontFamily: 'monospace', marginTop: 2 }}>
                            {new Date(log.created_at).toLocaleString()}
                          </div>
                        </td>
                        <td style={td}>
                          <Pill custom={pill(actionColor(log.action), log.action.replace(/_/g,' '))}/>
                        </td>
                        <td style={{ ...td, fontSize: 11, fontFamily: 'monospace', color: 'rgba(255,255,255,0.4)' }}>
                          <div>{log.target_type}</div>
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>{log.target_id?.slice(0,20)}…</div>
                        </td>
                        <td style={{ ...td, fontSize: 11, fontFamily: 'monospace', color: 'rgba(255,255,255,0.3)' }}>
                          {log.admin_id.slice(0,12)}…
                        </td>
                        <td style={{ ...td, fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                          {Object.keys(log.payload ?? {}).filter(k => k !== 'action').slice(0,2).map(k =>
                            <div key={k}>{k}: {String(log.payload[k]).slice(0,20)}</div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* ══ BAN MODAL ══ */}
      {banModal && (
        <Modal title={`Ban user — ${banModal.email}`} onClose={() => setBanModal(null)}>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginBottom: 16, lineHeight: 1.6 }}>
            This immediately signs the user out and blocks their access. Their data is preserved.
          </p>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 6 }}>Reason (visible in audit log)</label>
          <input value={banReason} onChange={e => setBanReason(e.target.value)} placeholder="Spam, ToS violation, abuse…" style={{ ...inputStyle, marginBottom: 16 }}/>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setBanModal(null)} style={btn(undefined, true)}>Cancel</button>
            <button onClick={() => { userAction(banModal.id, 'ban', { reason: banReason }); setBanModal(null) }}
              style={{ ...btn('#f87171'), background: '#f87171', color: '#000', border: 'none' }}>
              Confirm Ban
            </button>
          </div>
        </Modal>
      )}

      {/* ══ WALLET MODAL ══ */}
      {walletModal && (
        <Modal title={`Adjust wallet — ${walletModal.email}`} onClose={() => setWalletModal(null)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 6 }}>🪙 Coins to add</label>
              <input type="number" value={walletCoins} onChange={e => setWalletCoins(parseInt(e.target.value)||0)} style={inputStyle}/>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 6 }}>💎 Gems to add</label>
              <input type="number" value={walletGems} onChange={e => setWalletGems(parseInt(e.target.value)||0)} style={inputStyle}/>
            </div>
          </div>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', margin: '8px 0 0' }}>
            Amounts are added to the user&apos;s existing balance.
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setWalletModal(null)} style={btn(undefined, true)}>Cancel</button>
            <button onClick={() => { 
                if (walletCoins > 0) userAction(walletModal.id, 'add_coins', { value: walletCoins })
                if (walletGems > 0) userAction(walletModal.id, 'add_gems', { value: walletGems })
                setWalletModal(null) 
              }}
              style={{ ...btn(ac), background: ac, color: '#000', border: 'none' }}>Save</button>
          </div>
        </Modal>
      )}

      {/* ══ USER DETAIL MODAL ══ */}
      {viewUser && (
        <Modal title={`User detail — ${viewUser.email}`} onClose={() => setViewUser(null)} width={540}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {[
              { label: 'User ID',      value: viewUser.id,            mono: true  },
              { label: 'Email',        value: viewUser.email,         mono: false },
              { label: 'Plan',         value: viewUser.plan,          mono: false },
              { label: 'Admin',        value: viewUser.is_admin ? 'Yes' : 'No', mono: false },
              { label: 'Coins',        value: String(viewUser.coins), mono: false },
              { label: 'Gems',         value: String(viewUser.gems),  mono: false },
              { label: 'Projects limit', value: String(viewUser.projects_limit), mono: false },
              { label: 'Joined',       value: new Date(viewUser.created_at).toLocaleDateString(), mono: false },
              { label: 'Last active',  value: timeAgo(viewUser.last_sign_in), mono: false },
              { label: 'Banned',       value: viewUser.banned_at ? new Date(viewUser.banned_at).toLocaleDateString() : 'No', mono: false },
            ].map(f => (
              <div key={f.label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{f.label}</div>
                <div style={{ fontSize: 12, color: '#fff', fontFamily: f.mono ? 'monospace' : 'inherit', wordBreak: 'break-all' }}>{f.value}</div>
              </div>
            ))}
          </div>
          {viewUser.ban_reason && (
            <div style={{ marginTop: 12, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#f87171', marginBottom: 4 }}>BAN REASON</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{viewUser.ban_reason}</div>
            </div>
          )}

          {viewUserActivity.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
                textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)',
                marginBottom: 10,
              }}>
                Recent transactions
              </div>
              {viewUserActivity.slice(0, 6).map((tx, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', padding: '6px 0',
                  borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 11,
                }}>
                  <span style={{
                    color: tx.type === 'credit' ? '#34d399' : '#f87171',
                    fontWeight: 700, minWidth: 60,
                  }}>
                    {tx.type === 'credit' ? '+' : '−'}{tx.amount} {tx.currency}
                  </span>
                  <span style={{
                    flex: 1, color: 'rgba(255,255,255,0.45)', marginLeft: 10,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {tx.description}
                  </span>
                  <span style={{ color: 'rgba(255,255,255,0.2)', marginLeft: 8 }}>
                    {timeAgo(tx.created_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}

      {/* ══ MODEL MODAL ══ */}
      {modelModal && (
        <Modal title={modelModal.id ? 'Edit model' : 'Add new model'} onClose={() => setModelModal(null)} width={520}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {([
                { key: 'provider',       label: 'Provider',        placeholder: 'groq / cerebras / anthropic' },
                { key: 'model_id',       label: 'Model ID',        placeholder: 'llama-3.3-70b-versatile'     },
                { key: 'label',          label: 'Display name',    placeholder: 'Llama 3.3 70B ⚡'            },
                { key: 'context_window', label: 'Context window',  placeholder: '8192'                        },
                { key: 'cost_coins',     label: '🪙 Coin cost',    placeholder: '5'                           },
                { key: 'cost_gems',      label: '💎 Gem cost',     placeholder: '10'                          },
                { key: 'sort_order',     label: 'Sort order',      placeholder: '0'                           },
              ] as { key: string; label: string; placeholder: string }[]).map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</label>
                  <input
                    value={String((modelModal as Record<string,unknown>)[key] ?? '')}
                    onChange={e => setModelModal(p => ({ ...p, [key]: e.target.value }))}
                    placeholder={placeholder}
                    style={{ ...inputStyle, fontSize: 12 }}
                  />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              {[
                { key: 'is_free',  label: 'Free tier (costs coins)' },
                { key: 'enabled',  label: 'Enabled (visible to users)' },
              ].map(({ key, label }) => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
                  <input
                    type="checkbox"
                    checked={Boolean((modelModal as Record<string,unknown>)[key])}
                    onChange={e => {
                      const v = e.target.checked
                      setModelModal(p => ({
                        ...p,
                        [key]: v,
                        ...(key === 'is_free' ? { tier_required: v ? 'free' : 'pro' } : {}),
                      }))
                    }}
                    style={{ width: 14, height: 14 }}
                  />
                  {label}
                </label>
              ))}
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Notes (internal)</label>
              <textarea
                value={String(modelModal.notes ?? '')}
                onChange={e => setModelModal(p => ({ ...p, notes: e.target.value }))}
                placeholder="Deprecated March 2026, replaced by…"
                rows={2}
                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
            <button onClick={() => setModelModal(null)} style={btn(undefined, true)}>Cancel</button>
            <button onClick={saveModel} style={{ ...btn(ac), background: ac, color: '#000', border: 'none' }}>
              {modelModal.id ? 'Save changes' : 'Add model'}
            </button>
          </div>
        </Modal>
      )}

      {/* ══ CONFIRM DELETE ══ */}
      {confirmDelete && (
        <Modal title="Confirm permanent deletion" onClose={() => setConfirmDelete(null)}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 20 }}>
            <AlertTriangle size={20} color="#f87171" style={{ flexShrink: 0, marginTop: 2 }}/>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.7, margin: 0 }}>
              You are about to permanently delete <strong style={{ color: '#fff' }}>{confirmDelete.label}</strong>.
              {confirmDelete.type === 'user' && ' All their projects, context files, PAM threads, and wallet data will be erased. This cannot be undone.'}
              {confirmDelete.type === 'model' && ' Users will no longer be able to select this model. This cannot be undone.'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setConfirmDelete(null)} style={btn(undefined, true)}>Cancel</button>
            <button onClick={() => {
              if (confirmDelete.type === 'user') deleteUser(confirmDelete.id)
              else deleteModel(confirmDelete.id)
            }} style={{ padding: '7px 18px', borderRadius: 8, background: '#f87171', color: '#000', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 800 }}>
              Delete permanently
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
