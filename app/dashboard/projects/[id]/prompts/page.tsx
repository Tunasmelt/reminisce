'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { 
  Search,
  Terminal
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/hooks/useTheme'

interface Prompt {
  id: string
  raw_prompt: string
  structured_prompt: string
  prompt_type: string
  created_at: string
  feature_id?: string
  features?: { 
    name: string
    phases?: { name: string }
  }
}

function hexToRgba(hex: string, a: number) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

export default function PromptsPage() {
  const params = useParams()
  const router = useRouter()
  const { accent } = useTheme()
  const projectId = params.id as string

  const [project, setProject] = useState<{name: string} | null>(null)
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null)
  const [activeType, setActiveType] = useState('ALL')
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({})

  const [showCreate, setShowCreate] = useState(false)
  const [newRawPrompt, setNewRawPrompt] = useState('')
  const [newFeatureId, setNewFeatureId] = useState('')
  const [newCategory, setNewCategory] = useState('FEATURE_BUILD')
  const [newStructuring, setNewStructuring] = useState(false)
  const [features, setFeatures] = useState<Array<{ id: string, name: string }>>([])

  const toggleSection = (phase: string) => {
    setCollapsedSections(prev => ({
      ...prev,
      [phase]: !prev[phase]
    }))
  }

  useEffect(() => {
    const fetchProjAndFeatures = async () => {
      const [{ data: projData }, { data: featData }] = await Promise.all([
        supabase.from('projects').select('name').eq('id', projectId).single(),
        supabase.from('features')
          .select('id, name')
          .eq('project_id', projectId)
          .order('created_at', { ascending: true })
      ])
      if (projData) setProject(projData)
      if (featData) setFeatures(featData)
    }
    fetchProjAndFeatures()
  }, [projectId])

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowCreate(false)
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [])

  const loadPrompts = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const typeParam = activeType === 'ALL' ? 'All' : activeType
      const res = await fetch(`/api/prompts/list?projectId=${projectId}&type=${typeParam}`, {
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      })
      const data = await res.json()
      if (data.prompts) {
        setPrompts(data.prompts)
        if (data.prompts.length > 0 && !selectedPrompt) setSelectedPrompt(data.prompts[0])
      }
    } catch { toast.error('Registry sync failed') }
    finally { setLoading(false) }
  }, [projectId, activeType, selectedPrompt])

  useEffect(() => { loadPrompts() }, [loadPrompts])

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Prompt copied to clipboard')
  }

  const filteredPrompts = prompts.filter(p => 
    p.raw_prompt?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.structured_prompt?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Group filtered prompts by phase name
  const groupedPrompts = filteredPrompts.reduce(
    (acc, prompt) => {
      const phaseName = 
        (prompt.features as { 
          name: string
          phases?: { name: string } 
        } | undefined)?.phases?.name 
        || 'Unassigned'
      if (!acc[phaseName]) acc[phaseName] = []
      acc[phaseName].push(prompt)
      return acc
    },
    {} as Record<string, typeof filteredPrompts>
  )

  if (loading) return <div style={{ padding: 48, background: '#000', color: '#fff' }}>Querying Prompt Registry...</div>

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 104px)', background: '#000' }}>
      <title>{`Reminisce — Prompts — ${project?.name}`}</title>
      
      {/* LEFT COLUMN: ARCHIVE LIST */}
      <div style={{ 
        width: 380, 
        borderRight: '1px solid rgba(255,255,255,0.06)', 
        display: 'flex', 
        flexDirection: 'column',
        background: 'rgba(255,255,255,0.01)'
      }}>
        <div style={{ padding: 24, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={{
              fontSize: 11, fontWeight: 500,
              letterSpacing: '0.03em',
              textTransform: 'none',
              color: 'rgba(255,255,255,0.35)',
              margin: 0
            }}>
              Prompts
            </h2>
            <button 
              onClick={() => setShowCreate(true)}
              style={{ 
                background: 'transparent', 
                border: `1px solid ${accent}`, 
                color: accent, 
                borderRadius: 8, 
                padding: '6px 12px', 
                fontSize: 11, 
                fontWeight: 600, 
                textTransform: 'none',
                cursor: 'pointer' 
              }}>
              + New
            </button>
          </div>

          <div style={{ position: 'relative', marginBottom: 16 }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }} />
            <input 
              type="text" 
              placeholder="Filter logic..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8,
                padding: '10px 12px 10px 36px',
                fontSize: 12,
                color: '#fff',
                outline: 'none'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 4 }}>
            {['ALL', 'FEATURE_BUILD', 'BUG_FIX', 'REFACTOR', 'API_TEST', 'ARCHITECTURE'].map(type => (
              <button 
                key={type}
                onClick={() => setActiveType(type)}
                style={{
                  padding: '5px 12px',
                  borderRadius: 999,
                  fontSize: 9,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  border: `1px solid ${activeType === type ? accent : 'rgba(255,255,255,0.1)'}`,
                  background: activeType === type ? hexToRgba(accent, 0.1) : 'transparent',
                  color: activeType === type ? accent : 'rgba(255,255,255,0.4)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none' }}>
          {/* Grouped prompts list */}
          {Object.keys(groupedPrompts).length === 0 ? (
            <div style={{
              padding: '40px 20px',
              textAlign: 'center',
              color: 'rgba(255,255,255,0.2)',
              fontSize: 12,
              lineHeight: 1.6,
            }}>
              {searchQuery || activeType !== 'ALL'
                ? 'No prompts match your filter.'
                : 'No prompts yet. Run the Wizard to generate prompts.'}
            </div>
          ) : (
            Object.entries(groupedPrompts).map(
              ([phaseName, phasePrompts]) => (
              <div key={phaseName} style={{ marginBottom: 4 }}>
                
                {/* Phase section header */}
                <button
                  onClick={() => toggleSection(phaseName)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 16px',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center', gap: 8,
                  }}>
                    <span style={{
                      fontSize: 10, fontWeight: 800,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      color: accent,
                    }}>
                      {phaseName}
                    </span>
                    <span style={{
                      fontSize: 9, fontWeight: 700,
                      padding: '1px 6px',
                      borderRadius: 999,
                      background: hexToRgba(accent, 0.1),
                      color: accent,
                      letterSpacing: '0.04em',
                    }}>
                      {phasePrompts.length}
                    </span>
                  </div>
                  <span style={{
                    fontSize: 10,
                    color: 'rgba(255,255,255,0.25)',
                    transition: 'transform 0.15s',
                    display: 'inline-block',
                    transform: collapsedSections[phaseName]
                      ? 'rotate(-90deg)'
                      : 'rotate(0deg)',
                  }}>
                    ▾
                  </span>
                </button>

                {/* Prompt cards in this phase */}
                {!collapsedSections[phaseName] && (
                  <div>
                    {phasePrompts.map(prompt => {
                      const isSelected = 
                        selectedPrompt?.id === prompt.id
                      
                      const typeColors: 
                        Record<string, string> = {
                        FEATURE_BUILD: '#3b82f6',
                        BUG_FIX:       '#ef4444',
                        REFACTOR:      '#f59e0b',
                        API_TEST:      '#10b981',
                        ARCHITECTURE:  '#8b5cf6',
                      }
                      const typeColor = 
                        typeColors[prompt.prompt_type] 
                        || '#6b7280'

                      return (
                        <div
                          key={prompt.id}
                          onClick={() => 
                            setSelectedPrompt(prompt)}
                          style={{
                            padding: '10px 16px',
                            cursor: 'pointer',
                            borderBottom: '1px solid rgba(255,255,255,0.04)',
                            background: isSelected
                              ? hexToRgba(accent, 0.06)
                              : 'transparent',
                            borderLeft: isSelected
                              ? `2px solid ${accent}`
                              : '2px solid transparent',
                            transition: 'all 0.12s',
                          }}
                          onMouseEnter={e => {
                            if (!isSelected) {
                              e.currentTarget.style.background 
                                = 'rgba(255,255,255,0.03)'
                            }
                          }}
                          onMouseLeave={e => {
                            if (!isSelected) {
                              e.currentTarget.style.background 
                                = 'transparent'
                            }
                          }}
                        >
                          {/* Top row: type badge + feature name */}
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6, marginBottom: 5,
                          }}>
                            <span style={{
                              fontSize: 8, fontWeight: 800,
                              letterSpacing: '0.08em',
                              textTransform: 'uppercase',
                              padding: '2px 6px',
                              borderRadius: 4,
                              background: `${typeColor}20`,
                              color: typeColor,
                              border: `1px solid ${typeColor}40`,
                              flexShrink: 0,
                            }}>
                              {prompt.prompt_type
                                ?.replace('_', ' ')
                                || 'PROMPT'}
                            </span>
                            
                            {/* Feature name badge */}
                            {(prompt.features as 
                              { name: string } | undefined
                            )?.name && (
                              <span style={{
                                fontSize: 9,
                                color: 'rgba(255,255,255,0.35)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                maxWidth: 120,
                              }}>
                                {(prompt.features as 
                                  { name: string }
                                ).name}
                              </span>
                            )}
                          </div>

                          {/* Prompt preview text */}
                          <div style={{
                            fontSize: 11,
                            color: isSelected
                              ? 'rgba(255,255,255,0.7)'
                              : 'rgba(255,255,255,0.45)',
                            lineHeight: 1.5,
                            overflow: 'hidden',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical' as const,
                          }}>
                            {prompt.raw_prompt?.slice(0, 80)}
                            {(prompt.raw_prompt?.length || 0) > 80
                              ? '...' : ''}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: DETAIL VIEW */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#000' }}>
        {selectedPrompt ? (
          <>
            <div style={{ padding: '32px 48px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h1 style={{
                  fontSize: 24, fontWeight: 800,
                  color: '#fff', textTransform: 'uppercase',
                  letterSpacing: '-0.01em',
                  lineHeight: 1.2, marginBottom: 6,
                }}>
                  {selectedPrompt.features?.name 
                    || 'Prompt'}
                </h1>
                <div style={{ fontSize: 11, color: accent, fontWeight: 500, marginTop: 4, textTransform: 'none' }}>
                  {selectedPrompt.prompt_type.charAt(0).toUpperCase() + selectedPrompt.prompt_type.slice(1).toLowerCase().replace('_', ' ')} · {new Date(selectedPrompt.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <button 
                  onClick={() => copyToClipboard(selectedPrompt.structured_prompt)}
                  style={{
                    border: `1px solid ${accent}`,
                    color: accent,
                    background: 'transparent',
                    borderRadius: 999,
                    padding: '10px 24px',
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: 'none',
                    cursor: 'pointer'
                  }}
                >
                  Copy structured
                </button>
                <button 
                  onClick={() => {
                    const promptText = encodeURIComponent(
                      selectedPrompt.structured_prompt || 
                      selectedPrompt.raw_prompt || ''
                    )
                    const featureParam = selectedPrompt.feature_id
                      ? `&featureId=${selectedPrompt.feature_id}`
                      : ''
                    router.push(
                      `/dashboard/projects/${projectId}/agent?prompt=${promptText}${featureParam}`
                    )
                  }}
                  style={{
                    background: accent, color: '#000',
                    border: 'none', borderRadius: 999,
                    padding: '10px 20px',
                    fontSize: 11, fontWeight: 800,
                    display: 'flex', alignItems: 'center',
                    gap: 6, cursor: 'pointer',
                  }}
                >
                  Send to Agent →
                </button>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '48px', position: 'relative' }}>
              {/* RAW SECTION */}
              <div style={{ marginBottom: 40 }}>
                <label style={{ 
                  fontSize: 10, fontWeight: 700,
                  letterSpacing: '0.06em',
                  color: 'rgba(255,255,255,0.3)',
                  textTransform: 'uppercase',
                  marginBottom: 8,
                  display: 'block'
                }}>
                  Raw prompt
                </label>
                <div style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 12,
                  padding: 24,
                  fontSize: 14,
                  color: 'rgba(255,255,255,0.6)',
                  lineHeight: 1.6,
                  fontStyle: 'italic'
                }}>
                  {selectedPrompt.raw_prompt}
                </div>
              </div>

              {/* STRUCTURED SECTION */}
              <div>
                <div style={{
                  fontSize: 10, fontWeight: 700,
                  letterSpacing: '0.06em',
                  color: 'rgba(255,255,255,0.3)',
                  textTransform: 'uppercase',
                  marginBottom: 8,
                }}>
                  Structured Output
                </div>
                <div style={{
                  background: 'rgba(0,0,0,0.6)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 10, padding: '16px 20px',
                  fontFamily: 'monospace',
                  fontSize: 12,
                  lineHeight: 1.75,
                }}>
                  <div style={{
                    color: 'rgba(255,255,255,0.25)',
                    marginBottom: 8,
                  }}>
                    {'// REMINISCE STRUCTURED PROMPT'}
                  </div>
                  <div style={{ color: accent, whiteSpace: 'pre-wrap' }}>
                    {selectedPrompt.structured_prompt}
                  </div>
                </div>
              </div>

              {/* METADATA ROW */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 12, marginTop: 24,
              }}>
                {[
                  { label: 'Type', 
                    value: selectedPrompt.prompt_type
                      ?.replace('_', ' ') },
                  { label: 'Phase', 
                    value: selectedPrompt.features
                      ?.phases?.name || '—' },
                  { label: 'Created', 
                    value: new Date(selectedPrompt.created_at)
                      .toLocaleDateString([], {
                        month: 'short', day: 'numeric',
                        year: 'numeric'
                      }) },
                ].map(item => (
                  <div key={item.label} style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 8, padding: '10px 14px',
                  }}>
                    <div style={{
                      fontSize: 9, fontWeight: 700,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      color: 'rgba(255,255,255,0.25)',
                      marginBottom: 4,
                    }}>
                      {item.label}
                    </div>
                    <div style={{
                      fontSize: 13, fontWeight: 600,
                      color: '#fff',
                    }}>
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.2 }}>
            <Terminal size={64} style={{ marginBottom: 24 }} />
            <p style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.2em' }}>
              Select record for inspection
            </p>
          </div>
        )}
      </div>

      {showCreate && (
        <div
          onClick={() => setShowCreate(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(4px)',
            zIndex: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 560,
              background: '#0a0a0a',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 16,
              padding: 28,
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
            }}
          >
            <div style={{
              fontSize: 16, fontWeight: 700,
              color: '#fff',
            }}>
              New Prompt
            </div>

            {/* Category selector */}
            <div>
              <div style={{
                fontSize: 10, fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.35)',
                marginBottom: 8,
              }}>
                Type
              </div>
              <div style={{
                display: 'flex', gap: 6,
                flexWrap: 'wrap',
              }}>
                {['FEATURE_BUILD', 'BUG_FIX', 
                  'REFACTOR', 'API_TEST', 
                  'ARCHITECTURE'].map(cat => (
                  <button
                    key={cat}
                    onClick={() => setNewCategory(cat)}
                    style={{
                      padding: '4px 10px',
                      border: `1px solid ${
                        newCategory === cat
                          ? hexToRgba(accent, 0.5)
                          : 'rgba(255,255,255,0.1)'}`,
                      borderRadius: 6,
                      background: newCategory === cat
                        ? hexToRgba(accent, 0.12)
                        : 'transparent',
                      color: newCategory === cat
                        ? accent
                        : 'rgba(255,255,255,0.4)',
                      fontSize: 9, fontWeight: 700,
                      letterSpacing: '0.07em',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      transition: 'all 0.12s',
                    }}
                  >
                    {cat.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Feature selector */}
            {features.length > 0 && (
              <div>
                <div style={{
                  fontSize: 10, fontWeight: 600,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'rgba(255,255,255,0.35)',
                  marginBottom: 8,
                }}>
                  Link to feature (optional)
                </div>
                <select
                  value={newFeatureId}
                  onChange={e => 
                    setNewFeatureId(e.target.value)}
                  style={{
                    width: '100%',
                    background: '#111',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    padding: '9px 12px',
                    fontSize: 13, color: '#fff',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <option value="">No feature</option>
                  {features.map(f => (
                    <option key={f.id} value={f.id}
                      style={{ background: '#111' }}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Raw prompt textarea */}
            <div>
              <div style={{
                fontSize: 10, fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.35)',
                marginBottom: 8,
              }}>
                Prompt
              </div>
              <textarea
                value={newRawPrompt}
                onChange={e => 
                  setNewRawPrompt(e.target.value)}
                placeholder="Describe what you want to build or fix..."
                rows={6}
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  padding: '10px 14px',
                  fontSize: 13, color: '#fff',
                  outline: 'none', resize: 'none',
                  lineHeight: 1.6,
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
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
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => {
                  setShowCreate(false)
                  setNewRawPrompt('')
                  setNewFeatureId('')
                  setNewCategory('FEATURE_BUILD')
                }}
                style={{
                  flex: 1, padding: '10px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  background: 'transparent',
                  color: 'rgba(255,255,255,0.4)',
                  fontSize: 11, fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              
              <button
                onClick={async () => {
                  if (!newRawPrompt.trim()) {
                    toast.error('Enter a prompt first')
                    return
                  }
                  setNewStructuring(true)
                  try {
                    const { data: { session } } = 
                      await supabase.auth.getSession()
                    const res = await fetch(
                      '/api/prompts/structure',
                      {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'Authorization': 
                            `Bearer ${session?.access_token}`,
                        },
                        body: JSON.stringify({
                          rawPrompt: newRawPrompt,
                          projectId,
                          featureId: newFeatureId || undefined,
                          promptType: newCategory,
                          provider: 'openrouter',
                          model: 'meta-llama/llama-3.3-70b-instruct:free',
                        }),
                      }
                    )
                    if (!res.ok) throw new Error(
                      await res.text()
                    )
                    toast.success(
                      'Prompt saved and structured'
                    )
                    setShowCreate(false)
                    setNewRawPrompt('')
                    setNewFeatureId('')
                    setNewCategory('FEATURE_BUILD')
                    loadPrompts()
                  } catch (err) {
                    toast.error(
                      err instanceof Error 
                        ? err.message 
                        : 'Failed to structure prompt'
                    )
                  } finally {
                    setNewStructuring(false)
                  }
                }}
                disabled={newStructuring || 
                          !newRawPrompt.trim()}
                style={{
                  flex: 2, padding: '10px',
                  background: newStructuring || 
                              !newRawPrompt.trim()
                    ? 'rgba(255,255,255,0.1)'
                    : accent,
                  color: newStructuring || 
                         !newRawPrompt.trim()
                    ? 'rgba(255,255,255,0.3)'
                    : '#000',
                  border: 'none', borderRadius: 8,
                  fontSize: 11, fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  cursor: newStructuring || 
                          !newRawPrompt.trim()
                    ? 'not-allowed' : 'pointer',
                }}
              >
                {newStructuring 
                  ? 'Structuring...' 
                  : '✦ Structure + Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
