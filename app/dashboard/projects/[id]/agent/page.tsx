'use client'

import {
  useState, useEffect, useCallback,
  useRef, Suspense,
} from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import {
  ArrowUp, Plus, Edit2, Check, X,
  ChevronRight, ChevronDown, Trash2,
  Zap, AlertCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { getTimeUntilUTCReset } from '@/lib/wallet'
import ReactMarkdown from 'react-markdown'
import { useTheme } from '@/hooks/useTheme'
import CustomSelect from '@/components/CustomSelect'

// ─── Types ───────────────────────────────────────────────────────────────────

interface PamThread {
  id: string
  title: string | null
  model_used: string | null
  message_count: number
  last_message_at: string
  created_at: string
}

interface PamMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  model_used: string | null
  tokens_used: number | null
  action_type: string | null
  action_payload: Record<string, unknown> | null
  action_confirmed: boolean | null
  created_at: string
}

interface PendingAction {
  messageId: string
  actionType: string
  actionPayload: Record<string, unknown>
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hexToRgba(hex: string, a: number) {
  if (!hex || hex.length < 7) return `rgba(245,158,11,${a})`
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDate(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return 'Today'
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function actionLabel(type: string, payload: Record<string, unknown>): string {
  switch (type) {
    case 'UPDATE_FEATURE_STATUS':
      return `Mark "${payload.featureName}" as ${payload.newStatus}`
    case 'UPDATE_PHASE_STATUS':
      return `Mark phase "${payload.phaseName}" as ${payload.newStatus}`
    case 'CREATE_PROMPT':
      return `Save prompt for "${payload.featureName ?? 'feature'}"`
    default:
      return 'Perform action'
  }
}

// ─── Model list ──────────────────────────────────────────────────────────────

const MODELS = [
  { provider: 'openrouter', model: 'meta-llama/llama-3.3-70b-instruct:free', label: 'Llama 3.3 70B ★', free: true },
  { provider: 'groq',       model: 'llama-3.1-8b-instant',                    label: 'Llama 3.1 8B (Groq) ★', free: true },
  { provider: 'cerebras',   model: 'llama3.1-8b',                              label: 'Llama 3.1 8B (Cerebras) ⚡★', free: true },
  { provider: 'cerebras',   model: 'llama-3.3-70b',                            label: 'Llama 3.3 70B (Cerebras) ⚡★', free: true },
  { provider: 'openrouter', model: 'mistralai/mistral-7b-instruct:free',        label: 'Mistral 7B ★', free: true },
  { provider: 'openrouter', model: 'nvidia/llama-3.1-nemotron-super-49b-v1:free', label: 'Nemotron 49B ★', free: true },
  { provider: 'mistral',    model: 'mistral-small-latest',                     label: 'Mistral Small', free: false },
  { provider: 'mistral',    model: 'mistral-large-latest',                     label: 'Mistral Large', free: false },
  { provider: 'anthropic',  model: 'claude-sonnet-4-20250514',                 label: 'Claude Sonnet', free: false },
  { provider: 'gemini',     model: 'gemini-2.5-flash',                         label: 'Gemini 2.5 Flash', free: false },
]

const SLASH_COMMANDS = [
  {
    cmd:     '/status',
    label:   'Project Status',
    desc:    'Full briefing — phases, features, completion %',
    template:'Give me a full project status briefing.',
    icon:    '📊',
  },
  {
    cmd:     '/briefing',
    label:   'Daily Briefing',
    desc:    'What\'s done, in progress, and next up',
    template:'Give me a daily standup briefing for this project.',
    icon:    '☀️',
  },
  {
    cmd:     '/done',
    label:   'Mark as Done',
    desc:    'Mark a feature or phase as done',
    template:'/done ',
    icon:    '✅',
    needsMention: true,
  },
  {
    cmd:     '/block',
    label:   'Mark as Blocked',
    desc:    'Mark a feature as blocked',
    template:'/block ',
    icon:    '🚫',
    needsMention: true,
  },
  {
    cmd:     '/prompt',
    label:   'Generate Prompt',
    desc:    'Generate a build prompt for a feature',
    template:'/prompt ',
    icon:    '⚡',
    needsMention: true,
  },
  {
    cmd:     '/add',
    label:   'Add Feature',
    desc:    'Add a new feature to a phase',
    template:'/add  to ',
    icon:    '➕',
  },
  {
    cmd:     '/risks',
    label:   'Identify Risks',
    desc:    'Find blockers and architectural risks',
    template:'Identify any risks, blockers, or concerns in this project.',
    icon:    '⚠️',
  },
  {
    cmd:     '/next',
    label:   'What\'s Next',
    desc:    'Suggest the next feature to build',
    template:'What should I work on next and why?',
    icon:    '→',
  },
]

// ─── Context drawer ───────────────────────────────────────────────────────────

function ContextDrawer({
  accent, contextFiles, phases, features,
  drawerOpen, setDrawerOpen, remindersData, onMarkDone,
}: {
  accent: string
  contextFiles: Array<{ file_path: string }>
  phases: Array<{ name: string; status: string }>
  features: Array<{ name: string; status: string; type: string }>
  drawerOpen: boolean
  setDrawerOpen: (v: boolean) => void
  remindersData: Array<{ id: string; text: string; due_date: string | null; done: boolean; created_at: string }>
  onMarkDone: (id: string) => void
}) {
  const doneFeatures = features.filter(f => f.status === 'done' || f.status === 'complete').length
  const progress = features.length > 0 ? Math.round((doneFeatures / features.length) * 100) : 0

  return (
    <div style={{
      borderTop: '1px solid rgba(255,255,255,0.07)',
      background: 'rgba(255,255,255,0.02)',
      flexShrink: 0,
      transition: 'max-height 0.3s ease',
      maxHeight: drawerOpen ? 320 : 40,
      overflow: 'hidden',
    }}>
      {/* Drawer toggle */}
      <button
        onClick={() => setDrawerOpen(!drawerOpen)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center',
          gap: 8, padding: '10px 20px',
          background: 'transparent', border: 'none',
          cursor: 'pointer', color: 'rgba(255,255,255,0.4)',
          fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        {drawerOpen ? <ChevronDown size={12}/> : <ChevronRight size={12}/>}
        Project Context
        <span style={{
          marginLeft: 'auto', fontSize: 10,
          background: hexToRgba(accent, 0.12),
          color: accent, borderRadius: 999, padding: '2px 8px',
          border: `1px solid ${hexToRgba(accent, 0.25)}`,
        }}>
          {contextFiles.length} files · {features.length} features{remindersData.length > 0 ? ` · ${remindersData.length} reminder${remindersData.length !== 1 ? 's' : ''}` : ''}
        </span>
      </button>

      {/* Drawer content */}
      <div style={{ padding: '0 20px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Progress */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Overall progress</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: accent }}>{progress}%</span>
          </div>
          <div style={{ height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 999 }}>
            <div style={{
              height: '100%', width: `${progress}%`,
              background: accent, borderRadius: 999,
              transition: 'width 0.5s ease',
            }}/>
          </div>
        </div>

        {/* Phases */}
        {phases.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {phases.map((p, i) => (
              <span key={i} style={{
                fontSize: 10, padding: '3px 9px', borderRadius: 999,
                background: p.status === 'done' || p.status === 'complete'
                  ? hexToRgba(accent, 0.15) : 'rgba(255,255,255,0.05)',
                border: `1px solid ${p.status === 'done' || p.status === 'complete'
                  ? hexToRgba(accent, 0.3) : 'rgba(255,255,255,0.1)'}`,
                color: p.status === 'done' || p.status === 'complete'
                  ? accent : 'rgba(255,255,255,0.45)',
                fontWeight: 600,
              }}>
                {p.name}
              </span>
            ))}
          </div>
        )}

        {/* Context files */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {contextFiles.map((f, i) => (
            <span key={i} style={{
              fontSize: 9, fontFamily: 'monospace', padding: '2px 7px',
              borderRadius: 4, background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#10b981',
            }}>
              ✓ {f.file_path.split('/').pop()}
            </span>
          ))}
        </div>

        {/* Reminders */}
        {remindersData.length > 0 && (
          <div style={{ marginTop: 4 }}>
            <div style={{
              fontSize: 9, fontWeight: 800, letterSpacing: '0.1em',
              textTransform: 'uppercase' as const,
              color: 'rgba(255,255,255,0.3)', marginBottom: 8,
            }}>
              Reminders ({remindersData.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {remindersData.map(r => (
                <div key={r.id} style={{
                  display: 'flex', alignItems: 'flex-start',
                  gap: 8, padding: '8px 10px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 8,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 12, color: 'rgba(255,255,255,0.7)',
                      lineHeight: 1.4,
                    }}>{r.text}</div>
                    {r.due_date && (
                      <div style={{
                        fontSize: 10, color: 'rgba(255,255,255,0.3)',
                        marginTop: 3,
                      }}>
                        Due {new Date(r.due_date).toLocaleDateString([], {
                          month: 'short', day: 'numeric',
                        })}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => onMarkDone(r.id)}
                    style={{
                      background: 'rgba(16,185,129,0.1)',
                      border: '1px solid rgba(16,185,129,0.2)',
                      borderRadius: 6, padding: '3px 8px',
                      fontSize: 10, fontWeight: 700,
                      color: '#10b981', cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    Done
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Suggestion chips ─────────────────────────────────────────────────────────

function SuggestionChips({
  accent, phases, features, onSelect,
}: {
  accent: string
  phases: Array<{ name: string }>
  features: Array<{ name: string; status: string }>
  onSelect: (text: string) => void
}) {
  const inProgress = features.find(f => f.status === 'in_progress')
  const firstPhase = phases[0]

  const chips = [
    'Give me a full project briefing',
    firstPhase ? `What's left in ${firstPhase.name}?` : 'What phases are planned?',
    inProgress  ? `What does "${inProgress.name}" involve?` : 'What features are in progress?',
    'Identify any risks or blockers',
    'Generate a prompt for the next feature to build',
    'Summarise what PAM has helped with recently',
  ].filter(Boolean)

  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap',
      gap: 8, justifyContent: 'center', maxWidth: 520,
    }}>
      {chips.map((chip, i) => (
        <button key={i} onClick={() => onSelect(chip as string)} style={{
          padding: '7px 16px',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 999,
          background: 'rgba(255,255,255,0.04)',
          color: 'rgba(255,255,255,0.55)',
          fontSize: 12, fontWeight: 500,
          cursor: 'pointer', transition: 'all 0.15s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = accent
          e.currentTarget.style.color = accent
          e.currentTarget.style.background = hexToRgba(accent, 0.08)
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
          e.currentTarget.style.color = 'rgba(255,255,255,0.55)'
          e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
        }}
        >
          {chip}
        </button>
      ))}
    </div>
  )
}

// ─── Thread list item ─────────────────────────────────────────────────────────

function ThreadItem({
  thread, isActive, accent, onSelect, onRename, onArchive,
}: {
  thread: PamThread
  isActive: boolean
  accent: string
  onSelect: () => void
  onRename: (title: string) => void
  onArchive: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(thread.title ?? '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const commitRename = () => {
    if (draft.trim()) onRename(draft.trim())
    setEditing(false)
  }

  return (
    <div
      onClick={() => !editing && onSelect()}
      style={{
        padding: '10px 12px', borderRadius: 10,
        marginBottom: 4, cursor: 'pointer',
        background: isActive ? hexToRgba(accent, 0.1) : 'transparent',
        border: `1px solid ${isActive ? hexToRgba(accent, 0.25) : 'transparent'}`,
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => {
        if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
      }}
      onMouseLeave={e => {
        if (!isActive) e.currentTarget.style.background = 'transparent'
      }}
    >
      {editing ? (
        <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
          <input
            ref={inputRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') setEditing(false)
            }}
            style={{
              flex: 1, background: 'rgba(255,255,255,0.08)',
              border: `1px solid ${accent}`,
              borderRadius: 6, padding: '3px 8px',
              fontSize: 12, color: '#fff', outline: 'none',
            }}
          />
          <button onClick={commitRename} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#10b981' }}>
            <Check size={13}/>
          </button>
          <button onClick={() => setEditing(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)' }}>
            <X size={13}/>
          </button>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 4 }}>
            <div style={{
              fontSize: 12, fontWeight: isActive ? 600 : 400,
              color: isActive ? '#fff' : 'rgba(255,255,255,0.65)',
              lineHeight: 1.4, overflow: 'hidden',
              display: '-webkit-box', WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical' as const,
              flex: 1,
            }}>
              {thread.title ?? 'New conversation'}
            </div>
            <div style={{ display: 'flex', gap: 2, flexShrink: 0, opacity: 0 }}
              className="thread-actions"
              onClick={e => e.stopPropagation()}
            >
              <button
                onClick={() => setEditing(true)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', padding: 2 }}
                title="Rename"
              ><Edit2 size={11}/></button>
              <button
                onClick={onArchive}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', padding: 2 }}
                title="Archive"
              ><Trash2 size={11}/></button>
            </div>
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 4 }}>
            {formatDate(thread.last_message_at)} · {thread.message_count} msg{thread.message_count !== 1 ? 's' : ''}
          </div>
        </>
      )}
    </div>
  )
}

function CommandPalette({
  query, commands, selectedIndex, accent, onSelect,
}: {
  query: string
  commands: typeof SLASH_COMMANDS
  selectedIndex: number
  accent: string
  onSelect: (cmd: typeof SLASH_COMMANDS[0]) => void
}) {
  const filtered = commands.filter(c =>
    c.cmd.includes(query.toLowerCase()) ||
    c.label.toLowerCase().includes(query.toLowerCase())
  )
  if (filtered.length === 0) return null

  return (
    <div style={{
      position: 'absolute', bottom: '100%', left: 0, right: 0,
      marginBottom: 8,
      background: 'rgba(10,10,24,0.97)',
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: 14,
      overflow: 'hidden',
      boxShadow: '0 -16px 48px rgba(0,0,0,0.5)',
      zIndex: 50,
    }}>
      {/* Header */}
      <div style={{
        padding: '8px 14px',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{
          fontSize: 10, fontWeight: 800, letterSpacing: '0.1em',
          textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)',
        }}>
          Commands
        </span>
        <span style={{
          fontSize: 10, color: 'rgba(255,255,255,0.2)',
        }}>
          ↑↓ navigate · Enter select · Esc close
        </span>
      </div>

      {/* Command list */}
      {filtered.map((c, i) => (
        <div
          key={c.cmd}
          onClick={() => onSelect(c)}
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 14px',
            background: i === selectedIndex % filtered.length
              ? hexToRgba(accent, 0.1) : 'transparent',
            borderBottom: '1px solid rgba(255,255,255,0.04)',
            cursor: 'pointer',
            transition: 'background 0.1s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = hexToRgba(accent, 0.08)
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = i === selectedIndex % filtered.length
              ? hexToRgba(accent, 0.1) : 'transparent'
          }}
        >
          <span style={{ fontSize: 16, width: 20, textAlign: 'center', flexShrink: 0 }}>
            {c.icon}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                fontSize: 12, fontWeight: 700,
                fontFamily: 'ui-monospace,monospace',
                color: i === selectedIndex % filtered.length
                  ? accent : '#fff',
              }}>
                {c.cmd}
              </span>
              <span style={{
                fontSize: 11, fontWeight: 600,
                color: 'rgba(255,255,255,0.5)',
              }}>
                {c.label}
              </span>
            </div>
            <div style={{
              fontSize: 11, color: 'rgba(255,255,255,0.3)',
              marginTop: 1,
            }}>
              {c.desc}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function MentionPicker({
  query,
  phases,
  features,
  selectedIndex,
  accent,
  onSelect,
}: {
  query: string
  phases:   Array<{ id: string; name: string; status: string }>
  features: Array<{ id: string; name: string; status: string; type: string }>
  selectedIndex: number
  accent: string
  onSelect: (entity: { type: 'feature'|'phase'; id: string; name: string }) => void
}) {
  const q = query.toLowerCase()

  const matchedFeatures = features
    .filter(f => f.name.toLowerCase().includes(q))
    .slice(0, 5)
    .map(f => ({ type: 'feature' as const, id: f.id, name: f.name, status: f.status, sub: f.type }))

  const matchedPhases = phases
    .filter(p => p.name.toLowerCase().includes(q))
    .slice(0, 3)
    .map(p => ({ type: 'phase' as const, id: p.id, name: p.name, status: p.status, sub: 'phase' }))

  const all = [...matchedFeatures, ...matchedPhases]
  if (all.length === 0) return null

  const statusColor = (s: string) => {
    if (s === 'done' || s === 'complete') return '#10b981'
    if (s === 'in_progress') return '#f59e0b'
    if (s === 'blocked') return '#ef4444'
    return 'rgba(255,255,255,0.3)'
  }

  return (
    <div style={{
      position: 'absolute', bottom: '100%', left: 0, right: 0,
      marginBottom: 8,
      background: 'rgba(10,10,24,0.97)',
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: 14, overflow: 'hidden',
      boxShadow: '0 -16px 48px rgba(0,0,0,0.5)',
      zIndex: 50,
    }}>
      <div style={{
        padding: '8px 14px',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}>
        <span style={{
          fontSize: 10, fontWeight: 800, letterSpacing: '0.1em',
          textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)',
        }}>
          Mention
        </span>
      </div>
      {all.map((entity, i) => (
        <div
          key={`${entity.type}-${entity.id}`}
          onClick={() => onSelect(entity)}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '9px 14px',
            background: i === selectedIndex % all.length
              ? hexToRgba(accent, 0.1) : 'transparent',
            borderBottom: '1px solid rgba(255,255,255,0.04)',
            cursor: 'pointer', transition: 'background 0.1s',
          }}
          onMouseEnter={e =>
            e.currentTarget.style.background = hexToRgba(accent, 0.08)
          }
          onMouseLeave={e => {
            e.currentTarget.style.background = i === selectedIndex % all.length
              ? hexToRgba(accent, 0.1) : 'transparent'
          }}
        >
          <span style={{
            fontSize: 9, fontWeight: 800, letterSpacing: '0.06em',
            textTransform: 'uppercase', padding: '2px 6px',
            borderRadius: 4,
            background: entity.type === 'feature'
              ? hexToRgba(accent, 0.12)
              : 'rgba(255,255,255,0.06)',
            color: entity.type === 'feature'
              ? accent : 'rgba(255,255,255,0.4)',
            flexShrink: 0,
          }}>
            {entity.type}
          </span>
          <span style={{
            fontSize: 13, fontWeight: 600,
            color: '#fff', flex: 1, minWidth: 0,
            overflow: 'hidden', textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {entity.name}
          </span>
          <span style={{
            fontSize: 9, fontWeight: 700,
            color: statusColor(entity.status),
            flexShrink: 0,
          }}>
            {entity.status}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

function PAMContent() {
  const params       = useParams()
  const searchParams = useSearchParams()
  const { accent }   = useTheme()
  const projectId    = params.id as string

  // ── State ──────────────────────────────────────────────────────────────────
  const [project,      setProject]      = useState<{ name: string; description: string | null } | null>(null)
  const [threads,      setThreads]      = useState<PamThread[]>([])
  const [activeThread, setActiveThread] = useState<string | null>(null)
  const [messages,     setMessages]     = useState<PamMessage[]>([])
  const [phases,       setPhases]       = useState<Array<{ id: string; name: string; status: string }>>([])
  const [features,     setFeatures]     = useState<Array<{ id: string; name: string; status: string; type: string }>>([])
  const [contextFiles, setContextFiles] = useState<Array<{ file_path: string }>>([])

  const [input,        setInput]        = useState(searchParams.get('prompt') ? decodeURIComponent(searchParams.get('prompt')!) : '')
  const [isStreaming,  setIsStreaming]   = useState(false)
  const [streamText,   setStreamText]   = useState('')
  const [focused,      setFocused]      = useState(false)
  const [loading,      setLoading]      = useState(true)
  const [drawerOpen,   setDrawerOpen]   = useState(false)
  const [pendingAction,setPendingAction]= useState<PendingAction | null>(null)
  const [memoryCount, setMemoryCount] = useState(0)

  const [briefingLoading, setBriefingLoading] = useState(false)
  const [riskBanner,      setRiskBanner]      = useState<{
    blockedCount: number
    staleCount:   number
    items:        string[]
  } | null>(null)
  const [riskDismissed,   setRiskDismissed]   = useState(false)

  const [reminders, setReminders] = useState<Array<{
    id: string
    text: string
    due_date: string | null
    done: boolean
    created_at: string
  }>>([])

  const [showCommands,   setShowCommands]   = useState(false)
  const [showMentions,   setShowMentions]   = useState(false)
  const [cmdQuery,       setCmdQuery]       = useState('')
  const [mentionQuery,   setMentionQuery]   = useState('')
  const [cmdIndex,       setCmdIndex]       = useState(0)
  const [mentionIndex,   setMentionIndex]   = useState(0)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const [selectedModel,    setSelectedModel]    = useState('llama-3.1-8b-instant')
  const [selectedProvider, setSelectedProvider] = useState('groq')

  const messagesEndRef = useRef<HTMLDivElement>(null)

  // ── Init ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    // Restore model preference from localStorage
    if (typeof window !== 'undefined') {
      const storedModel    = localStorage.getItem('wizard_model')
      const storedProvider = localStorage.getItem('wizard_provider')
      if (storedModel && storedProvider) {
        const match = MODELS.find((m) => m.model === storedModel)
        if (match) { setSelectedModel(match.model); setSelectedProvider(match.provider) }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadProjectData = useCallback(async () => {
    const [
      { data: proj },
      { data: ph },
      { data: feat },
      { data: ctx },
      { count: memCount },
    ] = await Promise.all([
      supabase.from('projects').select('name, description').eq('id', projectId).single(),
      supabase.from('phases').select('id, name, status').eq('project_id', projectId).order('order_index'),
      supabase.from('features').select('id, name, status, type').eq('project_id', projectId).order('priority'),
      supabase.from('contexts').select('file_path').eq('project_id', projectId),
      supabase
        .from('pam_thread_summaries')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId),
    ])
    if (proj)  setProject(proj)
    if (ph)    setPhases(ph)
    if (feat)  setFeatures(feat)
    if (ctx)   setContextFiles(ctx)
    if (typeof memCount === 'number') setMemoryCount(memCount)

    // Risk detection — blocked features + features stale > 14 days
    if (feat && feat.length > 0) {
      const blocked = feat.filter(f => f.status === 'blocked')
      // Features that are in_progress but project data lacks updated_at,
      // so we surface blocked + features with todo/planned if many
      const stale = feat.filter(
        f => f.status === 'todo' || f.status === 'planned'
      ).slice(0, 3)

      if (blocked.length > 0) {
        const items = [
          ...blocked.slice(0, 3).map(f => `"${f.name}" is blocked`),
          ...(blocked.length > 3 ? [`+${blocked.length - 3} more blocked`] : []),
        ]
        setRiskBanner({
          blockedCount: blocked.length,
          staleCount:   stale.length,
          items,
        })
      }
    }

    // Load reminders
    const { data: { session: remSession } } =
      await supabase.auth.getSession()
    const remRes = await fetch(
      `/api/pam/reminders?projectId=${projectId}`,
      { headers: { Authorization: `Bearer ${remSession?.access_token}` } }
    )
    const remData = await remRes.json()
    if (remData.reminders) setReminders(remData.reminders)
  }, [projectId])

  const loadThreads = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`/api/pam/threads?projectId=${projectId}`, {
      headers: { Authorization: `Bearer ${session?.access_token}` },
    })
    const data = await res.json()
    if (data.threads) setThreads(data.threads)
  }, [projectId])

  useEffect(() => {
    const init = async () => {
      await Promise.all([loadProjectData(), loadThreads()])
      setLoading(false)
    }
    init()
  }, [loadProjectData, loadThreads])

  // ── Load thread messages ───────────────────────────────────────────────────
  const loadMessages = useCallback(async (threadId: string) => {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`/api/pam/thread/${threadId}`, {
      headers: { Authorization: `Bearer ${session?.access_token}` },
    })
    const data = await res.json()
    if (data.messages) {
      setMessages(data.messages)
      // Check for any pending actions
      const pending = data.messages.findLast(
        (m: PamMessage) => m.role === 'assistant' && m.action_type && m.action_confirmed === null
      )
      if (pending) {
        setPendingAction({
          messageId:     pending.id,
          actionType:    pending.action_type!,
          actionPayload: pending.action_payload!,
        })
      }
    }
  }, [])

  const selectThread = useCallback(async (threadId: string) => {
    setActiveThread(threadId)
    setStreamText('')
    setPendingAction(null)
    await loadMessages(threadId)
  }, [loadMessages])

  // ── Auto-scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamText])

  // Close command palette and mention picker on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-pam-input]')) {
        setShowCommands(false)
        setShowMentions(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ── Create new thread ─────────────────────────────────────────────────────
  const createThread = useCallback(async (): Promise<string> => {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/pam/threads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({
        projectId,
        model:    selectedModel,
        provider: selectedProvider,
      }),
    })
    const data = await res.json()
    await loadThreads()
    return data.thread.id
  }, [projectId, selectedModel, selectedProvider, loadThreads])

  const handleInputChange = useCallback((val: string) => {
    setInput(val)

    // Slash command detection
    if (val.startsWith('/')) {
      setShowMentions(false)
      setCmdQuery(val.slice(1))
      setCmdIndex(0)
      setShowCommands(true)
      return
    }

    // @mention detection — find last @ in the string
    const lastAt = val.lastIndexOf('@')
    if (lastAt !== -1) {
      const afterAt = val.slice(lastAt + 1)
      // Only show picker if @ is at end or has partial query (no space yet)
      if (!afterAt.includes(' ') || afterAt.length === 0) {
        setShowCommands(false)
        setMentionQuery(afterAt)
        setMentionIndex(0)
        setShowMentions(true)
        return
      }
    }

    // No trigger active
    setShowCommands(false)
    setShowMentions(false)
  }, [])

  const handleSelectCommand = useCallback((cmd: typeof SLASH_COMMANDS[0]) => {
    setShowCommands(false)
    // Commands with templates that end in space need the cursor
    // positioned for the user to type the rest
    setInput(cmd.template)
    // If the command is a direct action (no mention needed), send immediately
    if (!cmd.needsMention && !cmd.template.endsWith(' ')) {
      // Will be sent by user pressing Enter
    }
    setTimeout(() => inputRef.current?.focus(), 0)
  }, [])

  const handleSelectMention = useCallback((entity: {
    type: 'feature' | 'phase'
    id: string
    name: string
  }) => {
    setShowMentions(false)
    // Replace the @[partial] at end of input with @feature:Name or @phase:Name
    const lastAt = input.lastIndexOf('@')
    const before = input.slice(0, lastAt)
    const mention = `@${entity.type}:${entity.name}`
    setInput(before + mention + ' ')
    setTimeout(() => inputRef.current?.focus(), 0)
  }, [input])

  const sendBriefing = useCallback(async () => {
    if (briefingLoading || isStreaming) return
    setBriefingLoading(true)

    // Create a fresh thread for the briefing
    const threadId = await createThread()
    setActiveThread(threadId)
    setMessages([])
    setPendingAction(null)
    setStreamText('')

    // Brief pause to let UI settle
    await new Promise(r => setTimeout(r, 150))

    // Pre-fill the input and send immediately
    const briefingMessage = 'Give me a full project status briefing — phases, feature completion percentages, what\'s in progress, what\'s blocked, and what I should focus on next.'

    setBriefingLoading(false)
    setIsStreaming(true)
    setStreamText('')

    // Optimistic user message
    const optimisticMsg: PamMessage = {
      id:               `opt-briefing-${Date.now()}`,
      role:             'user',
      content:          briefingMessage,
      model_used:       null,
      tokens_used:      null,
      action_type:      null,
      action_payload:   null,
      action_confirmed: null,
      created_at:       new Date().toISOString(),
    }
    setMessages([optimisticMsg])

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/pam/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          threadId,
          projectId,
          provider: selectedProvider,
          model:    selectedModel,
          content:  briefingMessage,
        }),
      })

      if (!res.ok) throw new Error('Briefing failed')

      const reader  = res.body!.getReader()
      const decoder = new TextDecoder()
      let   full    = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6)
          if (data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data)
            if (parsed.__pam_action) continue
            full += parsed.choices?.[0]?.delta?.content ?? ''
            setStreamText(full.replace(/\[PAM_ACTION\][\s\S]*?\[\/PAM_ACTION\]/g, '').trim())
          } catch { /* partial */ }
        }
      }

      await loadMessages(threadId)
      setStreamText('')
      await loadThreads()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Briefing failed')
      setMessages([])
    } finally {
      setIsStreaming(false)
    }
  }, [briefingLoading, isStreaming, createThread, projectId,
      selectedProvider, selectedModel, loadMessages, loadThreads,
      setPendingAction])

  // ── Send message ──────────────────────────────────────────────────────────
  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || isStreaming) return

    setInput('')
    setIsStreaming(true)
    setStreamText('')

    // Ensure we have an active thread
    let threadId = activeThread
    if (!threadId) {
      threadId = await createThread()
      setActiveThread(threadId)
    }

    // Optimistic user message
    const optimisticMsg: PamMessage = {
      id:               `opt-${Date.now()}`,
      role:             'user',
      content:          text,
      model_used:       null,
      tokens_used:      null,
      action_type:      null,
      action_payload:   null,
      action_confirmed: null,
      created_at:       new Date().toISOString(),
    }
    setMessages(prev => [...prev, optimisticMsg])

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/pam/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          threadId,
          projectId,
          provider: selectedProvider,
          model:    selectedModel,
          content:  text,
        }),
      })

      if (res.status === 402) {
        toast.error(`Out of coins. Resets ${getTimeUntilUTCReset()}.`, { duration: 8000 })
        setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id))
        return
      }
      if (!res.ok) throw new Error('PAM request failed')

      const reader  = res.body!.getReader()
      const decoder = new TextDecoder()
      let   full    = ''
      let   pamAction: PendingAction | null = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6)
          if (data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data)
            // PAM action meta event
            if (parsed.__pam_action) {
              pamAction = {
                messageId:     '',   // filled after reload
                actionType:    parsed.actionType,
                actionPayload: parsed.actionPayload,
              }
              continue
            }
            full += parsed.choices?.[0]?.delta?.content ?? ''
            setStreamText(full.replace(/\[PAM_ACTION\][\s\S]*?\[\/PAM_ACTION\]/g, '').trim())
          } catch { /* partial */ }
        }
      }

      // Reload messages from DB (includes saved assistant message with id)
      await loadMessages(threadId)
      setStreamText('')
      await loadThreads()

      // If PAM proposed an action, find the message id and set pending
      if (pamAction) {
        setMessages(prev => {
          const last = [...prev].reverse().find(
            m => m.role === 'assistant' && m.action_type && m.action_confirmed === null
          )
          if (last) {
            setPendingAction({ ...pamAction!, messageId: last.id })
          }
          return prev
        })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(msg)
      setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id))
    } finally {
      setIsStreaming(false)
    }
  }, [input, isStreaming, activeThread, createThread, projectId, selectedProvider, selectedModel, loadMessages, loadThreads])

  // ── Handle action confirm/reject ──────────────────────────────────────────
  const handleAction = useCallback(async (confirmed: boolean) => {
    if (!pendingAction) return
    const { messageId } = pendingAction
    setPendingAction(null)

    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/pam/message', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ messageId, confirmed }),
    })
    const data = await res.json()

    if (confirmed && data.executed) {
      toast.success('Done — project updated.')
      await loadProjectData()
    } else if (!confirmed) {
      toast.info('Action cancelled.')
    }

    // Reload messages to show updated action_confirmed state
    if (activeThread) await loadMessages(activeThread)
  }, [pendingAction, loadProjectData, activeThread, loadMessages])
 
  const handleMarkReminderDone = useCallback(async (reminderId: string) => {
    const { data: { session } } = await supabase.auth.getSession()
    await fetch(`/api/pam/reminders/${reminderId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ done: true }),
    })
    setReminders(prev => prev.filter(r => r.id !== reminderId))
  }, [])

  // ── Archive thread ────────────────────────────────────────────────────────
  const archiveThread = useCallback(async (threadId: string) => {
    const { data: { session } } = await supabase.auth.getSession()
    await fetch(`/api/pam/thread/${threadId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ archived: true }),
    })

    // Summarise thread in background for cross-thread memory
    supabase.auth.getSession().then(({ data: { session } }) => {
      fetch('/api/pam/summarise', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          threadId,
          provider: selectedProvider,
          model:    selectedModel,
        }),
      }).catch(() => { /* non-fatal */ })
    })
    if (activeThread === threadId) {
      setActiveThread(null)
      setMessages([])
    }
    await loadThreads()
    toast.success('Thread archived')
  }, [activeThread, loadThreads, selectedProvider, selectedModel])

  // ── Rename thread ─────────────────────────────────────────────────────────
  const renameThread = useCallback(async (threadId: string, title: string) => {
    const { data: { session } } = await supabase.auth.getSession()
    await fetch(`/api/pam/thread/${threadId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ title }),
    })
    await loadThreads()
  }, [loadThreads])

  const modelOptions = MODELS.map(m => ({ value: m.model, label: m.label }))

  const currentModelMeta = MODELS.find(m => m.model === selectedModel)

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#07070f' }}>
      <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Loading PAM...</div>
    </div>
  )

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100vh - 68px)',
      background: 'linear-gradient(160deg,rgba(var(--accent-rgb),0.03) 0%,transparent 50%),#07070f',
    }}>
      <title>{`PAM — ${project?.name ?? 'Project'}`}</title>

      <style>{`
        .thread-item:hover .thread-actions { opacity: 1 !important; }
        @keyframes pamBounce {
          0%,80%,100%{transform:scale(0.6);opacity:0.4}
          40%{transform:scale(1);opacity:1}
        }
        @keyframes pamPulse {
          0%,100%{opacity:1}50%{opacity:0.35}
        }
      `}</style>

      {/* ── TOP BAR ─────────────────────────────────────────────────────── */}
      <div style={{
        height: 52, borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center',
        padding: '0 16px', gap: 10, flexShrink: 0,
        background: 'rgba(8,8,20,0.8)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}>
        {/* PAM identity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <div style={{
            width: 26, height: 26, borderRadius: 8,
            background: hexToRgba(accent, 0.15),
            border: `1px solid ${hexToRgba(accent, 0.35)}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, color: accent,
            animation: 'pamPulse 3s ease-in-out infinite',
          }}>✦</div>
          <span style={{ fontSize: 12, fontWeight: 800, color: '#fff', letterSpacing: '0.04em' }}>PAM</span>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', fontWeight: 400 }}>Project Action Manager</span>
        </div>

        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.08)', flexShrink: 0 }}/>

        {/* Model selector */}
        <CustomSelect
          value={selectedModel}
          onChange={val => {
            const m = MODELS.find((x) => x.model === val)
            if (m) {
              setSelectedModel(m.model)
              setSelectedProvider(m.provider)
              if (typeof window !== 'undefined') {
                localStorage.setItem('wizard_model', m.model)
                localStorage.setItem('wizard_provider', m.provider)
              }
            }
          }}
          options={modelOptions}
          width={180}
          compact
        />

        {currentModelMeta?.free && (
          <span style={{
            fontSize: 9, fontWeight: 800, padding: '2px 7px',
            borderRadius: 999, background: 'rgba(16,185,129,0.1)',
            border: '1px solid rgba(16,185,129,0.25)', color: '#10b981',
          }}>FREE</span>
        )}

        <div style={{ flex: 1 }}/>

        {/* New thread */}
        <button
          onClick={async () => {
            // Summarise current thread in background before opening new one
            if (activeThread && messages.length > 0) {
              const { data: { session } } = await supabase.auth.getSession()
              fetch('/api/pam/summarise', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${session?.access_token}`,
                },
                body: JSON.stringify({
                  threadId: activeThread,
                  provider: selectedProvider,
                  model:    selectedModel,
                }),
              }).catch(() => { /* non-fatal */ })
            }
            const id = await createThread()
            setActiveThread(id)
            setMessages([])
            setPendingAction(null)
            setStreamText('')
          }}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 12px',
            background: hexToRgba(accent, 0.1),
            border: `1px solid ${hexToRgba(accent, 0.25)}`,
            borderRadius: 8, cursor: 'pointer',
            fontSize: 11, fontWeight: 700, color: accent,
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = hexToRgba(accent, 0.18) }}
          onMouseLeave={e => { e.currentTarget.style.background = hexToRgba(accent, 0.1) }}
        >
          <Plus size={13}/> New chat
        </button>
      </div>

      {/* ── TWO PANELS ──────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* LEFT — Thread list */}
        <div style={{
          width: 240, flexShrink: 0,
          borderRight: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', flexDirection: 'column',
          background: 'rgba(255,255,255,0.015)',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '10px 12px 8px',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            flexShrink: 0,
          }}>
            <div style={{
              display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', marginBottom: 8,
            }}>
              <span style={{
                fontSize: 9, fontWeight: 800,
                letterSpacing: '0.12em',
                textTransform: 'uppercase' as const,
                color: 'rgba(255,255,255,0.25)',
              }}>
                Threads
              </span>
              {/* Daily briefing button */}
              <button
                onClick={sendBriefing}
                disabled={briefingLoading || isStreaming}
                title="Daily project briefing"
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '4px 10px',
                  background: hexToRgba(accent, 0.1),
                  border: `1px solid ${hexToRgba(accent, 0.22)}`,
                  borderRadius: 8, cursor: 'pointer',
                  fontSize: 10, fontWeight: 700,
                  color: accent,
                  opacity: (briefingLoading || isStreaming) ? 0.45 : 1,
                  transition: 'all 0.15s',
                  whiteSpace: 'nowrap' as const,
                }}
                onMouseEnter={e => {
                  if (!briefingLoading && !isStreaming)
                    e.currentTarget.style.background = hexToRgba(accent, 0.18)
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = hexToRgba(accent, 0.1)
                }}
              >
                {briefingLoading ? (
                  <>
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: accent,
                      animation: 'pamPulse 1s infinite',
                    }}/>
                    Briefing...
                  </>
                ) : (
                  <>☀️ Briefing</>
                )}
              </button>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 8px' }}>
            {threads.length === 0 && (
              <div style={{
                padding: '20px 12px', textAlign: 'center',
                fontSize: 11, color: 'rgba(255,255,255,0.2)', lineHeight: 1.6,
              }}>
                No threads yet.<br/>Start a new chat above.
              </div>
            )}
            {threads.map(thread => (
              <div key={thread.id} className="thread-item">
                <ThreadItem
                  thread={thread}
                  isActive={activeThread === thread.id}
                  accent={accent}
                  onSelect={() => selectThread(thread.id)}
                  onRename={title => renameThread(thread.id, title)}
                  onArchive={() => archiveThread(thread.id)}
                />
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT — Chat */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          overflow: 'hidden', minWidth: 0,
        }}>

          {/* Context injection banner */}
          {project && (
            <div style={{
              padding: '7px 20px',
              background: hexToRgba(accent, 0.05),
              borderBottom: `1px solid ${hexToRgba(accent, 0.12)}`,
              display: 'flex', alignItems: 'center', gap: 8,
              flexShrink: 0,
            }}>
              <div style={{
                width: 6, height: 6, borderRadius: '50%',
                background: accent,
                animation: 'pamPulse 2.5s infinite', flexShrink: 0,
              }}/>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Context:</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: accent, fontFamily: 'monospace' }}>
                {project.name}
              </span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>·</span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                {phases.length} phases · {features.length} features · {contextFiles.length} context files
              </span>
              {memoryCount > 0 && (
                <>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>·</span>
                  <span style={{
                    fontSize: 11,
                    color: hexToRgba(accent, 0.8),
                    fontWeight: 600,
                  }}>
                    {memoryCount} memory{memoryCount !== 1 ? ' entries' : ''}
                  </span>
                </>
              )}
            </div>
          )}

          {/* Messages */}
          <div style={{
            flex: 1, overflowY: 'auto',
            padding: '24px 24px 8px',
            display: 'flex', flexDirection: 'column', gap: 20,
          }}>
            {/* Risk detection banner */}
            {riskBanner && !riskDismissed && (
              <div style={{
                background: 'rgba(239,68,68,0.07)',
                border: '1px solid rgba(239,68,68,0.22)',
                borderRadius: 14, padding: '12px 16px',
                display: 'flex', alignItems: 'flex-start',
                gap: 12, flexShrink: 0,
              }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 12, fontWeight: 700, color: '#f87171',
                    marginBottom: 4,
                  }}>
                    PAM detected {riskBanner.blockedCount} blocked feature{riskBanner.blockedCount !== 1 ? 's' : ''}
                  </div>
                  <div style={{
                    display: 'flex', flexDirection: 'column', gap: 2,
                  }}>
                    {riskBanner.items.map((item, i) => (
                      <div key={i} style={{
                        fontSize: 11, color: 'rgba(255,255,255,0.45)',
                      }}>
                        · {item}
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => {
                      setInput('What are the blockers in this project and how should I resolve them?')
                      setRiskDismissed(true)
                    }}
                    style={{
                      marginTop: 10, padding: '5px 12px',
                      background: 'rgba(239,68,68,0.12)',
                      border: '1px solid rgba(239,68,68,0.25)',
                      borderRadius: 8, cursor: 'pointer',
                      fontSize: 11, fontWeight: 700,
                      color: '#f87171',
                    }}
                  >
                    Ask PAM about blockers →
                  </button>
                </div>
                <button
                  onClick={() => setRiskDismissed(true)}
                  style={{
                    background: 'none', border: 'none',
                    cursor: 'pointer', color: 'rgba(255,255,255,0.25)',
                    fontSize: 16, lineHeight: 1, padding: '0 2px',
                    flexShrink: 0,
                  }}
                >×</button>
              </div>
            )}
            {/* Empty state */}
            {!activeThread && messages.length === 0 && !isStreaming && (
              <div style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                padding: '40px 24px', gap: 20,
              }}>
                <div style={{
                  width: 64, height: 64, borderRadius: 20,
                  background: hexToRgba(accent, 0.1),
                  border: `1px solid ${hexToRgba(accent, 0.3)}`,
                  boxShadow: `0 0 40px ${hexToRgba(accent, 0.15)}`,
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 28, color: accent,
                  animation: 'pamPulse 3s ease-in-out infinite',
                }}>✦</div>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', textAlign: 'center', marginBottom: 8 }}>
                    Hi, I&apos;m PAM
                  </div>
                  <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', textAlign: 'center', maxWidth: 360, lineHeight: 1.65 }}>
                    I know everything about <strong style={{ color: 'rgba(255,255,255,0.7)' }}>{project?.name}</strong>.
                    Ask me anything, or let me take action on your project.
                  </div>
                </div>
                <SuggestionChips
                  accent={accent}
                  phases={phases}
                  features={features}
                  onSelect={text => setInput(text)}
                />
              </div>
            )}

            {/* Message list */}
            {messages.map((msg) => {
              if (msg.role === 'system') return null
              const isUser = msg.role === 'user'
              return (
                <div key={msg.id} style={{
                  display: 'flex', gap: 12,
                  flexDirection: isUser ? 'row-reverse' : 'row',
                  alignItems: 'flex-start',
                }}>
                  {/* Avatar */}
                  <div style={{
                    width: 30, height: 30, borderRadius: 9,
                    background: isUser ? hexToRgba(accent, 0.18) : hexToRgba(accent, 0.08),
                    border: `1px solid ${hexToRgba(accent, isUser ? 0.35 : 0.2)}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                    fontSize: isUser ? 11 : 14,
                    fontWeight: 700, color: accent,
                  }}>
                    {isUser ? 'U' : '✦'}
                  </div>

                  {/* Bubble */}
                  <div style={{
                    maxWidth: '78%',
                    background: isUser
                      ? hexToRgba(accent, 0.1)
                      : 'rgba(255,255,255,0.045)',
                    border: `1px solid ${isUser ? hexToRgba(accent, 0.2) : 'rgba(255,255,255,0.08)'}`,
                    borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    padding: '12px 16px',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                  }}>
                    {/* Action badge */}
                    {!isUser && msg.action_type && (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        marginBottom: 10, paddingBottom: 8,
                        borderBottom: `1px solid ${hexToRgba(accent, 0.15)}`,
                      }}>
                        <Zap size={10} color={accent}/>
                        <span style={{ fontSize: 9, fontWeight: 800, color: accent, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                          Action proposed
                        </span>
                        {msg.action_confirmed === true && (
                          <span style={{ fontSize: 9, color: '#10b981', marginLeft: 'auto' }}>✓ Executed</span>
                        )}
                        {msg.action_confirmed === false && (
                          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginLeft: 'auto' }}>Cancelled</span>
                        )}
                      </div>
                    )}

                    {/* Content */}
                    <div
                      className="prose prose-invert prose-sm max-w-none prose-code:text-[var(--accent-primary)] prose-code:bg-white/5 prose-code:px-1.5 prose-code:rounded prose-pre:bg-white/5 prose-pre:border prose-pre:border-white/10 prose-code:before:content-none prose-code:after:content-none"
                      style={{ fontSize: 13, color: isUser ? '#fff' : 'rgba(255,255,255,0.88)', lineHeight: 1.75 }}
                    >
                      {isUser
                        ? <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                        : <ReactMarkdown>{msg.content}</ReactMarkdown>
                      }
                    </div>

                    {/* Timestamp */}
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', marginTop: 8, textAlign: isUser ? 'right' : 'left' }}>
                      {formatTime(msg.created_at)}
                      {msg.tokens_used && !isUser ? ` · ~${msg.tokens_used} tokens` : ''}
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Streaming bubble */}
            {isStreaming && (
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{
                  width: 30, height: 30, borderRadius: 9,
                  background: hexToRgba(accent, 0.08),
                  border: `1px solid ${hexToRgba(accent, 0.2)}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, fontSize: 14, color: accent,
                  animation: 'pamPulse 1.5s infinite',
                }}>✦</div>
                <div style={{
                  maxWidth: '78%',
                  background: 'rgba(255,255,255,0.045)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '16px 16px 16px 4px',
                  padding: '12px 16px',
                  fontSize: 13, color: 'rgba(255,255,255,0.88)', lineHeight: 1.75,
                  minWidth: 60,
                }}>
                  {streamText ? (
                    <div className="prose prose-invert prose-sm max-w-none">
                      <ReactMarkdown>{streamText}</ReactMarkdown>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 4 }}>
                      {[0, 0.2, 0.4].map((d, i) => (
                        <div key={i} style={{
                          width: 5, height: 5, borderRadius: '50%',
                          background: 'rgba(255,255,255,0.4)',
                          animation: `pamBounce 1.2s infinite`,
                          animationDelay: `${d}s`,
                        }}/>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div ref={messagesEndRef}/>
          </div>

          {/* ── ACTION CONFIRM BAR ───────────────────────────────────────── */}
          {pendingAction && !isStreaming && (
            <div style={{
              margin: '0 20px 8px',
              padding: '12px 16px',
              background: hexToRgba(accent, 0.08),
              border: `1px solid ${hexToRgba(accent, 0.3)}`,
              borderRadius: 12,
              display: 'flex', alignItems: 'center', gap: 12,
              flexShrink: 0,
            }}>
              <AlertCircle size={15} color={accent} style={{ flexShrink: 0 }}/>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', marginBottom: 2 }}>
                  PAM wants to: {actionLabel(pendingAction.actionType, pendingAction.actionPayload)}
                </div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
                  This will update your project data. Confirm to proceed.
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button
                  onClick={() => handleAction(false)}
                  style={{
                    padding: '6px 14px',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 8, cursor: 'pointer',
                    fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleAction(true)}
                  style={{
                    padding: '6px 14px',
                    background: accent, border: 'none',
                    borderRadius: 8, cursor: 'pointer',
                    fontSize: 11, fontWeight: 800, color: '#000',
                    boxShadow: `0 0 20px ${hexToRgba(accent, 0.4)}`,
                  }}
                >
                  Confirm
                </button>
              </div>
            </div>
          )}

          {/* ── CONTEXT DRAWER ──────────────────────────────────────────── */}
          <ContextDrawer
            accent={accent}
            contextFiles={contextFiles}
            phases={phases}
            features={features}
            drawerOpen={drawerOpen}
            setDrawerOpen={setDrawerOpen}
            remindersData={reminders}
            onMarkDone={handleMarkReminderDone}
          />

          {/* ── INPUT ───────────────────────────────────────────────────── */}
            <div
              data-pam-input="true"
              style={{
                borderTop: '1px solid rgba(255,255,255,0.08)',
                padding: '12px 20px',
                background: 'rgba(8,8,20,0.8)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                flexShrink: 0,
                position: 'relative',
              }}
            >
              {/* Command palette */}
              {showCommands && (
                <CommandPalette
                  query={cmdQuery}
                  commands={SLASH_COMMANDS}
                  selectedIndex={cmdIndex}
                  accent={accent}
                  onSelect={handleSelectCommand}
                />
              )}

              {/* Mention picker */}
              {showMentions && (
                <MentionPicker
                  query={mentionQuery}
                  phases={phases}
                  features={features}
                  selectedIndex={mentionIndex}
                  accent={accent}
                  onSelect={handleSelectMention}
                />
              )}
            <div style={{ display: 'flex', gap: 10 }}>
              <textarea
                value={input}
                onChange={e => handleInputChange(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onKeyDown={e => {
                  // Navigate command palette
                  if (showCommands) {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault()
                      setCmdIndex(i => i + 1)
                      return
                    }
                    if (e.key === 'ArrowUp') {
                      e.preventDefault()
                      setCmdIndex(i => Math.max(0, i - 1))
                      return
                    }
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      const filtered = SLASH_COMMANDS.filter(c =>
                        c.cmd.includes(cmdQuery.toLowerCase()) ||
                        c.label.toLowerCase().includes(cmdQuery.toLowerCase())
                      )
                      const cmd = filtered[cmdIndex % Math.max(1, filtered.length)]
                      if (cmd) handleSelectCommand(cmd)
                      return
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault()
                      setShowCommands(false)
                      return
                    }
                  }
                  // Navigate mention picker
                  if (showMentions) {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault()
                      setMentionIndex(i => i + 1)
                      return
                    }
                    if (e.key === 'ArrowUp') {
                      e.preventDefault()
                      setMentionIndex(i => Math.max(0, i - 1))
                      return
                    }
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      const q = mentionQuery.toLowerCase()
                      const allEntities = [
                        ...features.filter(f => f.name.toLowerCase().includes(q))
                          .slice(0, 5)
                          .map(f => ({ type: 'feature' as const, id: f.id, name: f.name, status: f.status })),
                        ...phases.filter(p => p.name.toLowerCase().includes(q))
                          .slice(0, 3)
                          .map(p => ({ type: 'phase' as const, id: p.id, name: p.name, status: p.status })),
                      ]
                      const entity = allEntities[mentionIndex % Math.max(1, allEntities.length)]
                      if (entity) handleSelectMention(entity)
                      return
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault()
                      setShowMentions(false)
                      return
                    }
                  }
                  // Normal send
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    sendMessage()
                  }
                }}
                ref={inputRef}
                placeholder={isStreaming ? 'PAM is thinking...' : 'Ask PAM anything about your project...'}
                disabled={isStreaming}
                rows={1}
                style={{
                  flex: 1, resize: 'none',
                  background: 'rgba(255,255,255,0.05)',
                  border: `1px solid ${focused ? accent : 'rgba(255,255,255,0.1)'}`,
                  boxShadow: focused ? `0 0 0 3px ${hexToRgba(accent, 0.1)}` : 'none',
                  borderRadius: 10, padding: '10px 14px',
                  fontSize: 13, color: '#fff',
                  outline: 'none',
                  minHeight: 42, maxHeight: 140,
                  lineHeight: 1.55, fontFamily: 'inherit',
                  transition: 'all 0.2s',
                  opacity: isStreaming ? 0.5 : 1,
                }}
              />
              <button
                onClick={sendMessage}
                disabled={isStreaming || !input.trim()}
                style={{
                  width: 42, height: 42,
                  borderRadius: 10, background: accent,
                  border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'center', flexShrink: 0,
                  opacity: (isStreaming || !input.trim()) ? 0.3 : 1,
                  transition: 'opacity 0.2s',
                  boxShadow: (!isStreaming && input.trim())
                    ? `0 0 20px ${hexToRgba(accent, 0.4)}` : 'none',
                }}
              >
                <ArrowUp size={17} color="#000"/>
              </button>
            </div>
            <div style={{
              fontSize: 10, marginTop: 6,
              color: 'rgba(255,255,255,0.12)',
              textAlign: 'center',
            }}>
              Enter to send · Shift+Enter new line ·{' '}
              <span
                style={{ color: 'rgba(255,255,255,0.22)', cursor: 'pointer' }}
                onClick={() => { setInput('/'); handleInputChange('/') }}
                title="See all commands"
              >
                / commands
              </span>
              {' '}·{' '}
              <span
                style={{ color: 'rgba(255,255,255,0.22)', cursor: 'pointer' }}
                onClick={() => { setInput('@'); handleInputChange('@') }}
                title="Mention a feature or phase"
              >
                @ mention
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PAMPage() {
  return (
    <Suspense fallback={<div style={{ flex: 1, background: '#07070f' }}/>}>
      <PAMContent/>
    </Suspense>
  )
}
