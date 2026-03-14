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

  const toggleSection = (phase: string) => {
    setCollapsedSections(prev => ({
      ...prev,
      [phase]: !prev[phase]
    }))
  }

  useEffect(() => {
    const fetchProj = async () => {
      const { data } = await supabase.from('projects').select('name').eq('id', projectId).single()
      if (data) setProject(data)
    }
    fetchProj()
  }, [projectId])

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
            <button style={{ 
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
                <h3 style={{ fontSize: 20, fontWeight: 800, color: '#fff', margin: 0, textTransform: 'uppercase', letterSpacing: '-0.02em' }}>
                  {selectedPrompt.features?.name || 'GLOBAL_PROTOCOL'}
                </h3>
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
                  onClick={() => router.push(`/dashboard/projects/${projectId}/agent?featureId=${selectedPrompt.feature_id || ''}`)}
                  style={{
                    background: accent,
                    color: '#000',
                    border: 'none',
                    borderRadius: 999,
                    padding: '10px 24px',
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: 'none',
                    cursor: 'pointer'
                  }}
                >
                  Send to Agent
                </button>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '48px', position: 'relative' }}>
              {/* RAW SECTION */}
              <div style={{ marginBottom: 48 }}>
                <label style={{ 
                  fontSize: 11, fontWeight: 500, 
                  color: 'rgba(255,255,255,0.35)', 
                  textTransform: 'none', letterSpacing: '0.03em', 
                  display: 'block', marginBottom: 16 
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
                <label style={{ 
                  fontSize: 11, fontWeight: 500, 
                  color: accent, 
                  textTransform: 'none', letterSpacing: '0.03em', 
                  display: 'block', marginBottom: 16 
                }}>
                  Structured output
                </label>
                <div style={{
                  background: hexToRgba(accent, 0.02),
                  border: `1px dashed ${hexToRgba(accent, 0.2)}`,
                  borderRadius: 12,
                  padding: 24,
                  fontSize: 14,
                  color: '#fff',
                  lineHeight: 1.7,
                  fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap'
                }}>
                  {selectedPrompt.structured_prompt}
                </div>
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
    </div>
  )
}
