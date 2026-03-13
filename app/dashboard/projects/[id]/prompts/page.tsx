'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { 
  Search,
  ChevronRight,
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
  features?: { name: string }
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
            <h2 style={{ fontSize: 13, fontWeight: 800, color: '#fff', letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0 }}>
              PROMPT_REGISTRY
            </h2>
            <button style={{ 
              background: 'transparent', 
              border: `1px solid ${accent}`, 
              color: accent, 
              borderRadius: 6, 
              padding: '6px 12px', 
              fontSize: 10, 
              fontWeight: 800, 
              cursor: 'pointer' 
            }}>
              + NEW
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

          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none' }}>
            {['ALL', 'FEATURE_BUILD', 'BUG_FIX', 'REFACTOR'].map(type => (
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

        <div style={{ flex: 1, overflowY: 'auto', padding: 12, scrollbarWidth: 'none' }}>
          {filteredPrompts.map(p => (
            <div 
              key={p.id}
              onClick={() => setSelectedPrompt(p)}
              style={{
                padding: 16,
                borderRadius: 10,
                background: selectedPrompt?.id === p.id ? 'rgba(255,255,255,0.05)' : 'transparent',
                border: `1px solid ${selectedPrompt?.id === p.id ? 'rgba(255,255,255,0.1)' : 'transparent'}`,
                cursor: 'pointer',
                marginBottom: 4,
                transition: 'all 0.2s'
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '80%' }}>
                  {p.features?.name || 'GLOBAL_PROTOCOL'}
                </span>
                <ChevronRight size={14} style={{ color: 'rgba(255,255,255,0.2)' }} />
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.raw_prompt.slice(0, 60)}...
              </div>
              <div style={{ marginTop: 8, fontSize: 9, fontWeight: 800, color: accent, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {p.prompt_type}
              </div>
            </div>
          ))}
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
                <div style={{ fontSize: 10, color: accent, fontWeight: 700, marginTop: 4, textTransform: 'uppercase' }}>
                  {selectedPrompt.prompt_type} • ARCHIVED_{new Date(selectedPrompt.created_at).toLocaleDateString()}
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
                    fontSize: 10,
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    cursor: 'pointer'
                  }}
                >
                  COPY STRUCTURED
                </button>
                <button 
                  onClick={() => router.push(`/dashboard/projects/${projectId}/agent?featureId=${selectedPrompt.feature_id || ''}`)}
                  style={{
                    background: accent,
                    color: '#000',
                    border: 'none',
                    borderRadius: 999,
                    padding: '10px 24px',
                    fontSize: 10,
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    cursor: 'pointer'
                  }}
                >
                  DEPLOY TO AGENT
                </button>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '48px', position: 'relative' }}>
              {/* RAW SECTION */}
              <div style={{ marginBottom: 48 }}>
                <label style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 16 }}>
                  RAW_INTENT_SOURCE
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
                <label style={{ fontSize: 10, fontWeight: 800, color: accent, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 16 }}>
                  STRUCTURED_PROTOCOL_RESULT
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
