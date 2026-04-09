'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Search, Terminal, Copy, Check, ChevronRight, BookOpen, Pencil, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/hooks/useTheme'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PromptFeature {
  id:     string
  name:   string
  status: string
  type:   string
  phases: { id: string; name: string } | null
}

interface Prompt {
  id:               string
  title:            string | null
  raw_prompt:       string | null
  structured_prompt:string | null
  prompt_type:      string
  is_master_prompt: boolean
  phase_id:         string | null
  feature_id:       string | null
  context_files:    string[] | null
  checklist:        string[] | null
  expected_output:  string | null
  model_suggested:  string | null
  run_count:        number
  last_used_at:     string | null
  created_at:       string
  features:         PromptFeature | null
}

function hexToRgba(hex: string, a: number) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

// ─── Copy button with feedback ────────────────────────────────────────────────

function CopyButton({
  text, label, accent,
}: { text: string; label: string; accent: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={copy}
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '7px 14px',
        background: copied ? hexToRgba(accent, 0.12) : 'rgba(255,255,255,0.04)',
        border: `1px solid ${copied ? hexToRgba(accent, 0.4) : 'rgba(255,255,255,0.1)'}`,
        borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s',
        fontSize: 11, fontWeight: 700,
        color: copied ? accent : 'rgba(255,255,255,0.5)',
      }}
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
      {copied ? 'Copied' : label}
    </button>
  )
}

// ─── Checklist item ───────────────────────────────────────────────────────────

function ChecklistItem({
  text, accent,
}: { text: string; accent: string }) {
  const [done, setDone] = useState(false)
  const toggle = async () => {
    setDone(d => !d)
    // Optimistic — actual checklist tick state is local-only for now
    // Full persistence can be added in a future pass
  }
  return (
    <div
      onClick={toggle}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        padding: '8px 0', cursor: 'pointer',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
      }}
    >
      <div style={{
        width: 16, height: 16, borderRadius: 4, flexShrink: 0, marginTop: 1,
        border: `1.5px solid ${done ? accent : 'rgba(255,255,255,0.2)'}`,
        background: done ? hexToRgba(accent, 0.15) : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.15s',
      }}>
        {done && <Check size={10} color={accent} />}
      </div>
      <span style={{
        fontSize: 12, color: done ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.65)',
        lineHeight: 1.5, textDecoration: done ? 'line-through' : 'none',
        transition: 'all 0.15s',
      }}>
        {text}
      </span>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PromptsPage() {
  const params  = useParams()
  const router  = useRouter()
  const { accent } = useTheme()
  const projectId   = params.id as string

  // ── Tab state ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'blueprint' | 'custom' | 'changelog'>('blueprint')

  // ── Data ───────────────────────────────────────────────────────────────────
  const [project,      setProject]      = useState<{ name: string } | null>(null)
  const [prompts,      setPrompts]      = useState<Prompt[]>([])
  const [features,     setFeatures]     = useState<Array<{ id: string; name: string }>>([])
  const [loading,      setLoading]      = useState(true)
  const [agentRunsLog, setAgentRunsLog] = useState<string | null>(null)
  const [changesLog,   setChangesLog]   = useState<string | null>(null)

  // ── Selection + UI ─────────────────────────────────────────────────────────
  const [selectedPrompt,    setSelectedPrompt]    = useState<Prompt | null>(null)
  const [searchQuery,       setSearchQuery]       = useState('')
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({})

  // ── Create modal ───────────────────────────────────────────────────────────
  const [showCreate,    setShowCreate]    = useState(false)
  const [newRawPrompt,  setNewRawPrompt]  = useState('')
  const [newFeatureId,  setNewFeatureId]  = useState('')
  const [newCategory,   setNewCategory]   = useState('FEATURE_BUILD')
  const [newStructuring,setNewStructuring]= useState(false)

  // ── Escape key ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowCreate(false) }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  // ── Initial data load ──────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      const [{ data: proj }, { data: feats }] = await Promise.all([
        supabase.from('projects').select('name').eq('id', projectId).single(),
        supabase.from('features').select('id, name').eq('project_id', projectId)
          .order('created_at', { ascending: true }),
      ])
      if (proj)  setProject(proj)
      if (feats) setFeatures(feats)
    }
    init()
  }, [projectId])

  // ── Load prompts/changelog based on active tab ─────────────────────────────
  const loadTab = useCallback(async (tab: typeof activeTab) => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(
        `/api/prompts/list?projectId=${projectId}&tab=${tab}`,
        { headers: { Authorization: `Bearer ${session?.access_token}` } },
      )
      const data = await res.json()

      if (tab === 'changelog') {
        setAgentRunsLog(data.agentRunsLog ?? null)
        setChangesLog(data.changesLog ?? null)
      } else {
        setPrompts(data.prompts ?? [])
        if (data.prompts?.length > 0) setSelectedPrompt(data.prompts[0])
        else setSelectedPrompt(null)
      }
    } catch { toast.error('Failed to load prompts') }
    finally   { setLoading(false) }
  }, [projectId])

  useEffect(() => { loadTab(activeTab) }, [loadTab, activeTab])

  // Auto-select first prompt when prompts list changes
  useEffect(() => {
    if (prompts.length > 0 && !selectedPrompt) {
      setSelectedPrompt(prompts[0])
    }
  }, [prompts, selectedPrompt])

  // ── Grouping ───────────────────────────────────────────────────────────────
  const filtered = prompts.filter(p =>
    !searchQuery ||
    p.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.raw_prompt?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.structured_prompt?.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const groupedByPhase = filtered.reduce((acc, p) => {
    // Master prompt always first in its own group
    if (p.is_master_prompt) {
      acc['✦ Master'] = [p, ...(acc['✦ Master'] ?? [])]
      return acc
    }
    const phaseName = (p.features?.phases as { name: string } | null | undefined)?.name
      ?? p.prompt_type ?? 'Unassigned'
    acc[phaseName] = [...(acc[phaseName] ?? []), p]
    return acc
  }, {} as Record<string, Prompt[]>)

  // Put Master first, then sort other groups alphabetically
  const sortedGroupKeys = [
    ...('✦ Master' in groupedByPhase ? ['✦ Master'] : []),
    ...Object.keys(groupedByPhase)
      .filter(k => k !== '✦ Master')
      .sort(),
  ]

  // ── Type colours ───────────────────────────────────────────────────────────
  const typeColor: Record<string, string> = {
    MASTER:        accent,
    PHASE_OVERVIEW:'#8b5cf6',
    FEATURE_BUILD: '#3b82f6',
    BUG_FIX:       '#ef4444',
    REFACTOR:      '#f59e0b',
    API_TEST:      '#10b981',
    ARCHITECTURE:  '#a78bfa',
    PAM_GENERATED: '#6b7280',
  }

  // ── Tab header renderer ────────────────────────────────────────────────────
  const tabs: Array<{ key: typeof activeTab; label: string; icon: React.ReactNode }> = [
    { key: 'blueprint', label: 'Blueprint',  icon: <BookOpen size={12} /> },
    { key: 'custom',    label: 'Custom',     icon: <Pencil size={12} /> },
    { key: 'changelog', label: 'Changelog',  icon: <Clock size={12} /> },
  ]

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: 'calc(100vh - 68px)',
      background: '#05050f', overflow: 'hidden',
    }}>
      <title>{`Reminisce — Prompts — ${project?.name ?? ''}`}</title>

      {/* ── TOP BAR ─────────────────────────────────────── */}
      <div style={{
        height: 52,
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        background: 'rgba(8,8,20,0.6)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        padding: '0 24px',
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Prompts</span>
          <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.1)' }} />
          <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{project?.name}</span>
        </div>

        {/* Tab switcher */}
        <div style={{ display: 'flex', gap: 0, alignSelf: 'stretch' }}>
          {tabs.map(t => {
            const isActive = activeTab === t.key
            return (
              <button
                key={t.key}
                onClick={() => { setActiveTab(t.key); setSelectedPrompt(null) }}
                style={{
                  padding: '0 20px',
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: 'transparent',
                  border: 'none',
                  borderBottom: isActive ? `2px solid ${accent}` : '2px solid transparent',
                  color: isActive ? '#fff' : 'rgba(255,255,255,0.4)',
                  fontSize: 13, fontWeight: isActive ? 700 : 400,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  marginBottom: -1,
                }}
              >
                {t.icon}
                {t.label}
              </button>
            )
          })}
        </div>

        <div style={{ width: 120, display: 'flex', justifyContent: 'flex-end' }}>
          {activeTab === 'custom' && (
            <button
              onClick={() => setShowCreate(true)}
              style={{
                padding: '6px 14px',
                background: accent, color: '#000',
                border: 'none', borderRadius: 999,
                fontSize: 11, fontWeight: 800,
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              + New Prompt
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

      {/* ═══════════════════════════════════════
          LEFT — List column
      ═══════════════════════════════════════ */}
      <div style={{
        width: 360, flexShrink: 0, display: 'flex', flexDirection: 'column',
        borderRight: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(255,255,255,0.025)',
      }}>
        <div style={{
          padding: '16px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(255,255,255,0.015)',
        }}>
          {activeTab !== 'changelog' && (
            <div style={{ position: 'relative' }}>
              <Search size={12} style={{
                position: 'absolute', left: 10, top: '50%',
                transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)',
              }} />
              <input
                type="text"
                placeholder="Search prompts..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  width: '100%', background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10,
                  padding: '8px 10px 8px 32px', fontSize: 12, color: '#fff',
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
          )}
        </div>

        {/* List body */}
        <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none' }}>
          {activeTab === 'changelog' ? (
            // Changelog — simple status
            <div style={{ padding: '20px 16px', fontSize: 12, color: 'rgba(255,255,255,0.3)', lineHeight: 1.7 }}>
              <div style={{ marginBottom: 12 }}>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>agent-runs.md</span>
                <span style={{ marginLeft: 8 }}>{agentRunsLog ? `${agentRunsLog.split('\n## ').length - 1} entries` : 'No entries yet'}</span>
              </div>
              <div>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>changes.md</span>
                <span style={{ marginLeft: 8 }}>{changesLog ? `${changesLog.split('\n## ').length - 1} entries` : 'No entries yet'}</span>
              </div>
              <div style={{ marginTop: 20, fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>
                These logs are appended automatically by PAM actions and agent runs.
              </div>
            </div>
          ) : loading ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>
              Loading...
            </div>
          ) : sortedGroupKeys.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 32px' }}>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)', lineHeight: 1.7, marginBottom: 24, whiteSpace: 'pre-wrap' }}>
                {activeTab === 'blueprint'
                  ? 'No blueprint prompts yet.\nRun the Wizard to generate your project blueprint.'
                  : 'No custom prompts yet.\nClick "+ New Prompt" to start building.'}
              </div>
              {activeTab === 'custom' && (
                <button
                  onClick={() => setShowCreate(true)}
                  style={{
                    background: accent, color: '#000', border: 'none',
                    borderRadius: 999, padding: '10px 24px',
                    fontSize: 12, fontWeight: 800, cursor: 'pointer',
                  }}
                >
                  Create Custom Prompt
                </button>
              )}
            </div>
          ) : (
            sortedGroupKeys.map(group => (
              <div key={group}>
                {/* Group header */}
                <div
                  onClick={() => setCollapsedSections(p => ({ ...p, [group]: !p[group] }))}
                  style={{
                    padding: '24px 16px 8px',
                    display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{
                    fontSize: 9, fontWeight: 800, letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: group === '✦ Master' ? accent : 'rgba(255,255,255,0.25)',
                  }}>
                    {group}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ChevronRight size={10} style={{
                      color: 'rgba(255,255,255,0.2)',
                      transform: collapsedSections[group] ? 'rotate(0)' : 'rotate(90deg)',
                      transition: 'transform 0.15s',
                    }} />
                  </div>
                </div>

                {/* Prompt cards */}
                {!collapsedSections[group] && groupedByPhase[group].map(p => {
                  const isSelected = selectedPrompt?.id === p.id
                  const tc = typeColor[p.prompt_type] ?? '#6b7280'
                  const displayTitle = p.title
                    ?? p.features?.name
                    ?? p.prompt_type?.replace(/_/g, ' ')
                    ?? 'Prompt'

                  return (
                    <div
                      key={p.id}
                      onClick={() => setSelectedPrompt(p)}
                      style={{
                        padding: '16px 20px', cursor: 'pointer',
                        borderRadius: 14,
                        background: isSelected ? hexToRgba(accent, 0.08) : 'rgba(255,255,255,0.025)',
                        border: isSelected
                          ? `1px solid ${hexToRgba(accent, 0.4)}`
                          : '1px solid rgba(255,255,255,0.07)',
                        margin: '0 12px 8px',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => {
                        if (!isSelected) {
                          e.currentTarget.style.borderColor = hexToRgba(accent, 0.25)
                          e.currentTarget.style.background = hexToRgba(accent, 0.03)
                        }
                      }}
                      onMouseLeave={e => {
                        if (!isSelected) {
                          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'
                          e.currentTarget.style.background = 'rgba(255,255,255,0.025)'
                        }
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <span style={{
                          fontSize: 8, fontWeight: 800, letterSpacing: '0.06em',
                          padding: '1px 5px', borderRadius: 4,
                          background: `${tc}20`, color: tc, border: `1px solid ${tc}40`,
                          flexShrink: 0,
                          textTransform: 'uppercase',
                        }}>
                          {p.prompt_type.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <div style={{
                        fontSize: 13, fontWeight: 600,
                        color: isSelected ? '#fff' : 'rgba(255,255,255,0.7)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        marginBottom: 4,
                      }}>
                        {displayTitle}
                      </div>
                      <div style={{
                        fontSize: 11, color: 'rgba(255,255,255,0.3)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {(p.raw_prompt ?? p.structured_prompt ?? '').slice(0, 60)}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════
          RIGHT — Detail / Changelog panel
      ═══════════════════════════════════════ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: 'rgba(255,255,255,0.01)' }}>

        {/* Changelog tab */}
        {activeTab === 'changelog' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '32px 40px' }}>
            {[
              { title: 'Agent Runs', content: agentRunsLog, file: 'reminisce/logs/agent-runs.md' },
              { title: 'Project Changes', content: changesLog, file: 'reminisce/logs/changes.md' },
            ].map(log => (
              <div key={log.file} style={{ marginBottom: 48 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div>
                    <h2 style={{ fontSize: 18, fontWeight: 800, color: '#fff', margin: 0 }}>{log.title}</h2>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 3, fontFamily: 'monospace' }}>{log.file}</div>
                  </div>
                  {log.content && (
                    <CopyButton text={log.content} label="Copy log" accent={accent} />
                  )}
                </div>
                {log.content ? (
                  <div style={{
                    background: 'rgba(4,4,16,0.8)', border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 12, padding: '20px 24px',
                    fontFamily: 'ui-monospace, monospace', fontSize: 12,
                    color: 'rgba(255,255,255,0.6)', lineHeight: 1.8, whiteSpace: 'pre-wrap',
                    maxHeight: 480, overflowY: 'auto',
                  }}>
                    {log.content}
                  </div>
                ) : (
                  <div style={{ padding: '24px', background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px dashed rgba(255,255,255,0.08)', textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>
                    No entries yet — this log is populated automatically as you use PAM and the agent.
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Blueprint + Custom tabs — prompt detail */}
        {activeTab !== 'changelog' && (
          selectedPrompt ? (
            <>
              {/* Detail header */}
              <div style={{
                padding: '20px 32px',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.02)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16,
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: 9, fontWeight: 800, letterSpacing: '0.08em',
                      padding: '2px 8px', borderRadius: 4,
                      background: `${typeColor[selectedPrompt.prompt_type] ?? '#6b7280'}20`,
                      color: typeColor[selectedPrompt.prompt_type] ?? '#6b7280',
                      border: `1px solid ${typeColor[selectedPrompt.prompt_type] ?? '#6b7280'}40`,
                    }}>
                      {selectedPrompt.prompt_type.replace(/_/g, ' ')}
                    </span>
                    {selectedPrompt.model_suggested && (
                      <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'monospace' }}>
                        {selectedPrompt.model_suggested}
                      </span>
                    )}
                    {selectedPrompt.run_count > 0 && (
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
                        ↻ Used {selectedPrompt.run_count} time{selectedPrompt.run_count !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <h1 style={{ fontSize: 20, fontWeight: 800, color: '#fff', margin: 0, lineHeight: 1.2 }}>
                    {selectedPrompt.title
                      ?? selectedPrompt.features?.name
                      ?? selectedPrompt.prompt_type.replace(/_/g, ' ')}
                  </h1>
                  {selectedPrompt.features?.phases && (
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>
                      {(selectedPrompt.features.phases as { name: string }).name}
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <CopyButton
                    text={selectedPrompt.structured_prompt ?? selectedPrompt.raw_prompt ?? ''}
                    label="Copy prompt"
                    accent={accent}
                  />
                  <CopyButton
                    text={[
                      selectedPrompt.structured_prompt ?? selectedPrompt.raw_prompt ?? '',
                      '',
                      '---',
                      'Context files to reference:',
                      ...(selectedPrompt.context_files ?? ['reminisce/context/architecture.md', 'reminisce/context/tech-stack.md']).map(f => `- ${f}`),
                    ].join('\n')}
                    label="Copy for editor"
                    accent={accent}
                  />
                  <button
                    onClick={() => {
                      const promptText = encodeURIComponent(
                        selectedPrompt.structured_prompt ?? selectedPrompt.raw_prompt ?? ''
                      )
                      const featureParam = selectedPrompt.feature_id
                        ? `&featureId=${selectedPrompt.feature_id}` : ''
                      router.push(`/dashboard/projects/${projectId}/agent?prompt=${promptText}${featureParam}`)
                    }}
                    style={{
                      background: accent, color: '#000', border: 'none',
                      borderRadius: 8, padding: '7px 16px',
                      fontSize: 11, fontWeight: 800, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 5,
                    }}
                  >
                    Open in Agent →
                  </button>
                </div>
              </div>

              {/* Detail body */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>

                {/* Structured prompt */}
                <div style={{ marginBottom: 28 }}>
                  <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginBottom: 12 }}>
                    Prompt Content
                  </div>
                  <div style={{
                    background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 10, padding: '16px',
                    fontFamily: 'ui-monospace, monospace', fontSize: 12,
                    color: 'rgba(255,255,255,0.8)', lineHeight: 1.7, whiteSpace: 'pre-wrap',
                    maxHeight: 500, overflowY: 'auto',
                  }}>
                    {selectedPrompt.structured_prompt ?? selectedPrompt.raw_prompt ?? '(empty)'}
                  </div>
                </div>

                {/* Checklist */}
                {selectedPrompt.checklist && selectedPrompt.checklist.length > 0 && (
                  <div style={{ marginBottom: 28 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 10 }}>
                      Completion Checklist
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: '12px 16px', border: '1px solid rgba(255,255,255,0.07)' }}>
                      {selectedPrompt.checklist.map((item, i) => (
                        <ChecklistItem
                          key={i}
                          text={item}
                          accent={accent}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Expected output */}
                {selectedPrompt.expected_output && (
                  <div style={{ marginBottom: 28 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 10 }}>
                      Expected Output
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: '14px 18px', border: '1px solid rgba(255,255,255,0.07)', fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
                      {selectedPrompt.expected_output}
                    </div>
                  </div>
                )}

                {/* Context files */}
                {selectedPrompt.context_files && selectedPrompt.context_files.length > 0 && (
                  <div style={{ marginBottom: 28 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 10 }}>
                      Context Files
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {selectedPrompt.context_files.map(f => (
                        <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.07)' }}>
                          <span style={{ fontSize: 9, color: accent }}>📄</span>
                          <code style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace' }}>{f}</code>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Metadata row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  {[
                    { label: 'Phase', value: (selectedPrompt.features?.phases as { name: string } | null | undefined)?.name ?? '—' },
                    { label: 'Feature', value: selectedPrompt.features?.name ?? '—' },
                    { label: 'Created', value: new Date(selectedPrompt.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) },
                  ].map(m => (
                    <div key={m.label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '10px 14px', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginBottom: 4 }}>{m.label}</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>{m.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
              <div style={{ width: 56, height: 56, borderRadius: 14, background: hexToRgba(accent, 0.08), border: `1px solid ${hexToRgba(accent, 0.15)}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Terminal size={24} color={hexToRgba(accent, 0.5)} />
              </div>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>
                Select a prompt to inspect it
              </p>
            </div>
          )
        )}
      </div>

      </div>

      {/* ═══════════════════════════════════════
          Create prompt modal (Custom tab)
      ═══════════════════════════════════════ */}
      {showCreate && (
        <div
          onClick={() => setShowCreate(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 540, background: 'rgba(10,10,24,0.98)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: 28, display: 'flex', flexDirection: 'column', gap: 16, boxShadow: '0 24px 80px rgba(0,0,0,0.5)' }}
          >
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>New Custom Prompt</div>

            {/* Type */}
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: 8 }}>Type</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {['FEATURE_BUILD', 'BUG_FIX', 'REFACTOR', 'API_TEST', 'ARCHITECTURE'].map(cat => (
                  <button
                    key={cat}
                    onClick={() => setNewCategory(cat)}
                    style={{
                      padding: '4px 10px', fontSize: 9, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase',
                      border: `1px solid ${newCategory === cat ? hexToRgba(accent, 0.5) : 'rgba(255,255,255,0.1)'}`,
                      borderRadius: 6,
                      background: newCategory === cat ? hexToRgba(accent, 0.12) : 'transparent',
                      color: newCategory === cat ? accent : 'rgba(255,255,255,0.4)',
                      cursor: 'pointer', transition: 'all 0.12s',
                    }}
                  >
                    {cat.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Feature link */}
            {features.length > 0 && (
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: 8 }}>Link to feature (optional)</div>
                <select
                  value={newFeatureId}
                  onChange={e => setNewFeatureId(e.target.value)}
                  style={{ width: '100%', background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: '#fff', outline: 'none', cursor: 'pointer' }}
                >
                  <option value="">No feature</option>
                  {features.map(f => <option key={f.id} value={f.id} style={{ background: '#111' }}>{f.name}</option>)}
                </select>
              </div>
            )}

            {/* Prompt textarea */}
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: 8 }}>Prompt</div>
              <textarea
                value={newRawPrompt}
                onChange={e => setNewRawPrompt(e.target.value)}
                placeholder="Describe what you want to build or fix..."
                rows={5}
                style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#fff', outline: 'none', resize: 'none', lineHeight: 1.6, fontFamily: 'inherit', boxSizing: 'border-box' }}
                onFocus={e => { e.currentTarget.style.borderColor = accent }}
                onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
              />
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => { setShowCreate(false); setNewRawPrompt(''); setNewFeatureId(''); setNewCategory('FEATURE_BUILD') }}
                style={{ flex: 1, padding: '10px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, background: 'transparent', color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                disabled={newStructuring || !newRawPrompt.trim()}
                onClick={async () => {
                  if (!newRawPrompt.trim()) { toast.error('Enter a prompt first'); return }
                  setNewStructuring(true)
                  try {
                    const { data: { session } } = await supabase.auth.getSession()
                    const res = await fetch('/api/prompts/structure', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
                      body: JSON.stringify({ rawPrompt: newRawPrompt, projectId, featureId: newFeatureId || undefined, promptType: newCategory, provider: 'openrouter', model: 'meta-llama/llama-3.3-70b-instruct:free' }),
                    })
                    if (!res.ok) throw new Error(await res.text())
                    toast.success('Prompt saved and structured')
                    setShowCreate(false); setNewRawPrompt(''); setNewFeatureId(''); setNewCategory('FEATURE_BUILD')
                    loadTab('custom')
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : 'Failed to structure prompt')
                  } finally { setNewStructuring(false) }
                }}
                style={{
                  flex: 2, padding: '10px',
                  background: newStructuring || !newRawPrompt.trim() ? 'rgba(255,255,255,0.08)' : accent,
                  color: newStructuring || !newRawPrompt.trim() ? 'rgba(255,255,255,0.3)' : '#000',
                  border: 'none', borderRadius: 8, fontSize: 11, fontWeight: 800,
                  cursor: newStructuring || !newRawPrompt.trim() ? 'not-allowed' : 'pointer',
                }}
              >
                {newStructuring ? 'Structuring...' : '✦ Structure + Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
