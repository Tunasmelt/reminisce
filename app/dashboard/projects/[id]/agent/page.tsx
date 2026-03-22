'use client'

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { 
  ArrowUp,
  Trash2
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import ReactMarkdown from 'react-markdown'
import { useTheme } from '@/hooks/useTheme'
import CustomSelect from '@/components/CustomSelect'



interface AgentRun {
  id: string;
  status: string;
  started_at: string;
  model_used: string;
  output?: string;
  input?: string;
  features?: {
    name: string;
  };
}

function hexToRgba(hex: string, a: number) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

function AgentRunnerContent() {
  const params = useParams()
  const searchParams = useSearchParams()
  const { accent } = useTheme()
  const projectId = params.id as string
  const initialFeatureId = searchParams.get('featureId')
  const initialPrompt = searchParams.get('prompt')
    ? decodeURIComponent(searchParams.get('prompt') || '')
    : ''

  const [project, setProject] = useState<{name: string} | null>(null)

  const [history, setHistory] = useState<AgentRun[]>([])
  const [loading, setLoading] = useState(true)

  const [features, setFeatures] = useState<Array<{
    id: string
    name: string
    phases?: { name: string }
  }>>([])
  const [selectedFeatureId, setSelectedFeatureId] = useState(initialFeatureId || '')
  const [selectedProvider, setSelectedProvider] = useState('mistral')
  const [selectedModel, setSelectedModel] = useState('mistral-small-latest')

  const MODELS = [
    // ── FREE TIER (OpenRouter, coins) ──────
    {
      provider: 'openrouter',
      model: 'meta-llama/llama-3.3-70b-instruct:free',
      label: 'Llama 3.3 70B',
      free: true,
      note: '',
    },
    {
      provider: 'openrouter',
      model: 'google/gemini-2.0-flash-exp:free',
      label: 'Gemini 2.0 Flash',
      free: true,
      note: '',
    },
    {
      provider: 'openrouter',
      model: 'mistralai/mistral-7b-instruct:free',
      label: 'Mistral 7B',
      free: true,
      note: '',
    },
    {
      provider: 'openrouter',
      model: 'mistralai/mistral-small-3.1-24b-instruct:free',
      label: 'Mistral Small 3.1',
      free: true,
      note: '',
    },
    {
      provider: 'openrouter',
      model: 'nvidia/llama-3.1-nemotron-super-49b-v1:free',
      label: 'NVIDIA Nemotron Super',
      free: true,
      note: '',
    },
    {
      provider: 'openrouter',
      model: 'nvidia/llama-nemotron-nano-8b-instruct:free',
      label: 'NVIDIA Nemotron Nano',
      free: true,
      note: '',
    },
    // ── PRO TIER (direct APIs, gems) ───────
    {
      provider: 'mistral',
      model: 'mistral-small-latest',
      label: 'Mistral Small',
      free: false,
      note: '',
    },
    {
      provider: 'mistral',
      model: 'mistral-large-latest',
      label: 'Mistral Large',
      free: false,
      note: '',
    },
    {
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      label: 'Claude Sonnet',
      free: false,
      note: '',
    },
    {
      provider: 'gemini',
      model: 'gemini-2.0-flash',
      label: 'Gemini Flash (Direct)',
      free: false,
      note: '',
    },
  ]
  
  const modelOptions = MODELS.map(m => ({
    value: m.model,
    label: m.free 
      ? `${m.label} ★` 
      : m.label,
  }))
  
  const [output, setOutput] = useState('')
  const [userInput, setUserInput] = useState(initialPrompt)
  const [isRunning, setIsRunning] = useState(false)
  const [localInputs, setLocalInputs] = useState<Record<string, string>>({})
  const [focused, setFocused] = useState(false)

  const [prompts, setPrompts] = useState<Array<{
    id: string
    raw_prompt: string
    structured_prompt: string
    prompt_type: string
    features?: { name: string }
  }>>([])
  const [selectedPromptId, setSelectedPromptId] = useState('')
  const [showPromptPicker, setShowPromptPicker] = useState(false)

  const messageEndRef = useRef<HTMLDivElement>(null)

  const loadHistory = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`/api/agent/history?projectId=${projectId}`, {
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      })
      const data = await res.json()
      if (data.runs) setHistory(data.runs)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }, [projectId])

  useEffect(() => {
    const init = async () => {
      const [{ data: proj }, { data: feat }] = await Promise.all([
        supabase.from('projects').select('name').eq('id', projectId).single(),
        supabase.from('features')
          .select('id, name, phases(name)')
          .eq('project_id', projectId)
          .order('created_at', { ascending: true })
      ])
      if (proj) setProject(proj)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (feat) setFeatures(feat as any)

      // Load prompts for this project
      const { data: promptData } = await supabase
        .from('prompts')
        .select('id, raw_prompt, structured_prompt, prompt_type, features(name)')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(50)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (promptData) setPrompts(promptData as any)

      loadHistory()
    }
    init()
  }, [projectId, loadHistory])

  useEffect(() => {
    if (messageEndRef.current) messageEndRef.current.scrollIntoView({ behavior: 'smooth' })
  }, [output, history])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-prompt-picker]')) {
        setShowPromptPicker(false)
      }
    }
    if (showPromptPicker) {
      document.addEventListener('mousedown', handler)
    }
    return () => 
      document.removeEventListener('mousedown', handler)
  }, [showPromptPicker])

  const handleRunAgent = async () => {
    if ((!selectedFeatureId && !userInput) || isRunning) return

    setIsRunning(true)
    const prompt = userInput
    setUserInput('')
    setOutput('')
    
    // Store input locally for display as fallback
    const tempId = Date.now().toString()
    setLocalInputs(prev => ({ ...prev, [tempId]: prompt }))
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/agent/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ 
          projectId, 
          featureId: selectedFeatureId, 
          provider: selectedProvider, 
          model: selectedModel,
          prompt: prompt
        })
      })

      if (res.status === 402) {
        const errData = await res.json()
        toast.error(errData.error || 'Insufficient balance')
        return
      }

      if (!res.ok) throw new Error('Agent failed to start')

      const reader = res.body?.getReader()
      if (!reader) throw new Error('Stream failed')

      const decoder = new TextDecoder()
      let fullText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6)
            if (dataStr === '[DONE]') continue
            try {
              const parsed = JSON.parse(dataStr)
              const content = parsed.choices?.[0]?.delta?.content || ''
              fullText += content; setOutput(fullText)
            } catch { fullText += dataStr; setOutput(fullText) }
          }
        }
      }
      loadHistory()
    } catch (err) {
      const msg = err instanceof Error 
        ? err.message : String(err)
      
      if (msg.includes('Rate limit') 
          || msg.includes('429')) {
        toast.error(msg, { 
          duration: 8000,
          description: 'Free models have a 20 req/min limit per IP address.'
        })
      } else {
        toast.error(msg, { duration: 6000 })
      }
    }
    finally { setIsRunning(false) }
  }

  const handleClearHistory = async () => {
    // Keep logic for clearing history if exists, or just ui for now
    toast.info('History archival initialized')
  }

  const handleLoadPrompt = (promptId: string) => {
    const p = prompts.find(x => x.id === promptId)
    if (!p) return
    // Load raw prompt into the input so user 
    // can review/edit before sending
    setUserInput(p.raw_prompt || p.structured_prompt)
    setSelectedPromptId(promptId)
    setShowPromptPicker(false)
    toast.success('Prompt loaded — press Enter or edit before sending')
  }

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 24, gap: 16 }}>
      <div style={{ height: 40, background: 'rgba(255,255,255,0.05)', borderRadius: 8, width: '40%' }} />
      <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', borderRadius: 12 }} />
    </div>
  )

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100vh - 104px)',
      background: '#000',
    }}>
      <title>{`Reminisce — Agent — ${project?.name}`}</title>
  
      {/* ── TOP BAR ── */}
      <div style={{
        height: 52,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center',
        padding: '0 20px', gap: 10,
        flexShrink: 0,
        background: 'rgba(0,0,0,0.5)',
      }}>
        <span style={{
          fontSize: 11, fontWeight: 500,
          letterSpacing: '0.03em', color: 'rgba(255,255,255,0.35)',
          textTransform: 'none', flexShrink: 0,
        }}>
          Agent
        </span>
  
        {/* Feature selector */}
        <CustomSelect
          value={selectedFeatureId}
          onChange={setSelectedFeatureId}
          options={[
            { value: '', label: 'All features' },
            ...features.map(f => ({
              value: f.id,
              label: f.name,
            }))
          ]}
          width={180}
          compact
        />
  
        {/* Model selector */}
        <CustomSelect
          value={selectedModel}
          onChange={val => {
            const m = MODELS.find(x => x.model === val)
            if (m) {
              setSelectedModel(m.model)
              setSelectedProvider(m.provider)
            }
          }}
          options={modelOptions}
          width={160}
          compact
        />

        {selectedModel.includes(':free') && (
          <span style={{
            fontSize: 10,
            color: 'rgba(255,255,255,0.2)',
            fontStyle: 'italic',
            display: 'flex', alignItems: 'center',
            gap: 4,
          }}
          title="OpenRouter free models require a payment method on your OpenRouter account. Rate limit: 20 req/min."
          >
            ⓘ requires openrouter.ai account
          </span>
        )}
  
        {(() => {
          const MODEL_COSTS: Record<string, {
            currency: string, amount: number
          }> = {
            'meta-llama/llama-3.3-70b-instruct:free':
              { currency: 'coins', amount: 1 },
            'google/gemini-2.0-flash-exp:free':
              { currency: 'coins', amount: 1 },
            'mistralai/mistral-7b-instruct:free':
              { currency: 'coins', amount: 1 },
            'mistralai/mistral-small-3.1-24b-instruct:free':
              { currency: 'coins', amount: 1 },
            'nvidia/llama-3.1-nemotron-super-49b-v1:free':
              { currency: 'coins', amount: 1 },
            'nvidia/llama-nemotron-nano-8b-instruct:free':
              { currency: 'coins', amount: 1 },
            'mistral-small-latest':
              { currency: 'gems', amount: 1 },
            'mistral-large-latest':
              { currency: 'gems', amount: 2 },
            'gemini-2.0-flash':
              { currency: 'gems', amount: 1 },
            'claude-sonnet-4-20250514':
              { currency: 'gems', amount: 3 },
            'gpt-4o':
              { currency: 'gems', amount: 3 },
          }
          const cost = MODEL_COSTS[selectedModel]
          if (!cost) return null
          const icon = cost.currency === 'gems' 
            ? '💎' : '🪙'
          return (
            <span style={{
              fontSize: 10, fontWeight: 600,
              color: cost.currency === 'gems'
                ? '#a78bfa' : 'rgba(255,255,255,0.3)',
              padding: '3px 8px',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 999,
              fontFamily: 'monospace',
            }}>
              {icon} {cost.amount}
            </span>
          )
        })()}

        {prompts.length > 0 && (
          <div 
            style={{ position: 'relative' }}
            data-prompt-picker="true"
          >
            <button
              onClick={() => 
                setShowPromptPicker(prev => !prev)}
              style={{
                display: 'flex', alignItems: 'center',
                gap: 5, padding: '5px 12px',
                border: `1px solid ${showPromptPicker
                  ? hexToRgba(accent, 0.4)
                  : 'rgba(255,255,255,0.1)'}`,
                borderRadius: 8,
                background: showPromptPicker
                  ? hexToRgba(accent, 0.08)
                  : 'transparent',
                color: showPromptPicker
                  ? accent : 'rgba(255,255,255,0.45)',
                fontSize: 11, fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.15s',
                flexShrink: 0,
              }}
            >
              Load prompt
              <span style={{
                fontSize: 9, fontWeight: 700,
                padding: '1px 5px',
                borderRadius: 999,
                background: hexToRgba(accent, 0.15),
                color: accent,
              }}>
                {prompts.length}
              </span>
            </button>

            {/* Prompt picker dropdown */}
            {showPromptPicker && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  left: 0,
                  width: 340,
                  background: '#111',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 12,
                  zIndex: 100,
                  boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
                  overflow: 'hidden',
                  maxHeight: 320,
                  overflowY: 'auto',
                }}
              >
                <div style={{
                  padding: '10px 14px',
                  borderBottom: '1px solid rgba(255,255,255,0.07)',
                  fontSize: 10, fontWeight: 600,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'rgba(255,255,255,0.35)',
                }}>
                  Select a prompt to load
                </div>
                {prompts.map(p => {
                  const typeColors: Record<string,string> = {
                    FEATURE_BUILD: '#3b82f6',
                    BUG_FIX: '#ef4444',
                    REFACTOR: '#f59e0b',
                    API_TEST: '#10b981',
                    ARCHITECTURE: '#8b5cf6',
                  }
                  const tc = typeColors[p.prompt_type] 
                    || '#6b7280'
                  return (
                    <div
                      key={p.id}
                      onClick={() => handleLoadPrompt(p.id)}
                      style={{
                        padding: '10px 14px',
                        borderBottom: 
                          '1px solid rgba(255,255,255,0.05)',
                        cursor: 'pointer',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background 
                          = 'rgba(255,255,255,0.06)'
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background 
                          = 'transparent'
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        alignItems: 'center', gap: 7,
                        marginBottom: 4,
                      }}>
                        <span style={{
                          fontSize: 8, fontWeight: 800,
                          padding: '2px 5px',
                          borderRadius: 3,
                          background: `${tc}20`,
                          color: tc,
                          border: `1px solid ${tc}40`,
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          flexShrink: 0,
                        }}>
                          {p.prompt_type?.replace('_',' ') || 'PROMPT'}
                        </span>
                        {(p.features as {name:string}|undefined)?.name && (
                          <span style={{
                            fontSize: 10,
                            color: 'rgba(255,255,255,0.4)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>
                            {(p.features as {name:string}).name}
                          </span>
                        )}
                      </div>
                      <div style={{
                        fontSize: 11,
                        color: 'rgba(255,255,255,0.55)',
                        lineHeight: 1.45,
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical' as const,
                      }}>
                        {p.raw_prompt?.slice(0, 100)}
                        {(p.raw_prompt?.length || 0) > 100 ? '...' : ''}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
  
        <div style={{ flex: 1 }} />
  
        <button
          onClick={handleClearHistory}
          style={{
            background: 'transparent', border: 'none',
            fontSize: 11, fontWeight: 500,
            letterSpacing: '0.03em', textTransform: 'none',
            color: 'rgba(255,255,255,0.2)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 5,
            transition: 'color 0.15s',
          }}
          onMouseEnter={e => 
            e.currentTarget.style.color = '#ef4444'
          }
          onMouseLeave={e => 
            e.currentTarget.style.color = 'rgba(255,255,255,0.2)'
          }
        >
          <Trash2 size={11} /> Clear
        </button>
      </div>
  
      {/* ── THREE PANELS ── */}
      <div style={{
        flex: 1, display: 'flex', overflow: 'hidden',
      }}>
  
        {/* LEFT PANEL — Run History */}
        <div style={{
          width: 260, flexShrink: 0,
          borderRight: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}>
            <div style={{
              padding: '12px 16px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              fontSize: 11, fontWeight: 500,
              letterSpacing: '0.03em', textTransform: 'none',
              color: 'rgba(255,255,255,0.35)',
            }}>
              Run history
            </div>
          <div style={{
            flex: 1, overflowY: 'auto', padding: '8px',
          }}>
            {loading && (
              <div style={{
                padding: 16, fontSize: 11,
                color: 'rgba(255,255,255,0.2)',
                textAlign: 'center',
              }}>
                Loading...
              </div>
            )}
            {!loading && history.length === 0 && (
              <div style={{
                padding: '24px 16px', fontSize: 11,
                color: 'rgba(255,255,255,0.2)',
                textAlign: 'center', lineHeight: 1.6,
              }}>
                No runs yet. Send a message to start.
              </div>
            )}
            {history.map(run => (
              <div
                key={run.id}
                style={{
                  padding: '10px 12px',
                  borderRadius: 8, marginBottom: 4,
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  cursor: 'default',
                }}
              >
                {/* Status badge */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center', gap: 6,
                  marginBottom: 5,
                }}>
                  <div style={{
                    width: 6, height: 6,
                    borderRadius: '50%',
                    background: run.status === 'complete'
                      ? '#10b981'
                      : run.status === 'failed'
                      ? '#ef4444'
                      : run.status === 'running'
                      ? accent
                      : 'rgba(255,255,255,0.3)',
                    animation: run.status === 'running'
                      ? 'agentPulse 1s infinite'
                      : 'none',
                  }} />
                  <span style={{
                    fontSize: 9, fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: run.status === 'complete'
                      ? '#10b981'
                      : run.status === 'failed'
                      ? '#ef4444'
                      : 'rgba(255,255,255,0.35)',
                  }}>
                    {run.status}
                  </span>
                  <span style={{
                    marginLeft: 'auto',
                    fontSize: 9,
                    color: 'rgba(255,255,255,0.2)',
                    fontFamily: 'monospace',
                  }}>
                    {new Date(run.started_at)
                      .toLocaleTimeString([], {
                        hour: '2-digit', minute: '2-digit'
                      })}
                  </span>
                </div>
                <div style={{
                  fontSize: 11, fontWeight: 600,
                  color: 'rgba(255,255,255,0.65)',
                  marginBottom: 2,
                }}>
                  {run.features?.name || 'General'}
                </div>
                <div style={{
                  fontSize: 10,
                  color: 'rgba(255,255,255,0.25)',
                  fontFamily: 'monospace',
                }}>
                  {run.model_used}
                </div>
              </div>
            ))}
          </div>
        </div>
  
        {/* CENTER PANEL — Chat */}
        <div style={{
          flex: 1, display: 'flex',
          flexDirection: 'column', overflow: 'hidden',
          minWidth: 0,
        }}>
          {/* Context injection banner */}
          {project && (
            <div style={{
              padding: '7px 20px',
              background: hexToRgba(accent, 0.04),
              borderBottom: `1px solid ${
                hexToRgba(accent, 0.1)}`,
              display: 'flex', alignItems: 'center',
              gap: 8, flexShrink: 0, flexWrap: 'wrap',
            }}>
              <div style={{
                width: 6, height: 6, borderRadius: '50%',
                background: accent,
                animation: 'agentPulse 2s infinite',
                flexShrink: 0,
              }} />
              <span style={{
                fontSize: 11,
                color: 'rgba(255,255,255,0.35)',
              }}>
                Context injected:
              </span>
              <span style={{
                fontSize: 11, fontWeight: 600,
                color: accent, fontFamily: 'monospace',
              }}>
                {project.name}
              </span>
              {selectedFeatureId && features.find(
                f => f.id === selectedFeatureId
              ) && (
                <>
                  <span style={{
                    color: 'rgba(255,255,255,0.2)',
                  }}>·</span>
                  <span style={{
                    fontSize: 11,
                    color: 'rgba(255,255,255,0.5)',
                  }}>
                    {features.find(
                      f => f.id === selectedFeatureId
                    )?.name}
                  </span>
                </>
              )}
            </div>
          )}
  
          {/* Messages */}
          <div style={{
            flex: 1, overflowY: 'auto',
            padding: '20px',
            display: 'flex', flexDirection: 'column',
            gap: 20,
          }}>
            {!loading && history.length === 0 
             && !isRunning && (
              <div style={{
                flex: 1, display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '40px 24px',
                gap: 16,
              }}>
                <div style={{
                  width: 52, height: 52,
                  borderRadius: 14,
                  background: hexToRgba(accent, 0.1),
                  border: `1px solid ${hexToRgba(accent, 0.25)}`,
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 22,
                }}>✦</div>
                <div style={{
                  fontSize: 18, fontWeight: 700,
                  color: '#fff', textAlign: 'center',
                }}>
                  Ask anything about your project
                </div>
                <div style={{
                  fontSize: 13,
                  color: 'rgba(255,255,255,0.4)',
                  textAlign: 'center', maxWidth: 340,
                  lineHeight: 1.6,
                }}>
                  Full project context is injected 
                  automatically into every message — 
                  no prompt engineering needed.
                </div>
                {/* Suggestion chips */}
                <div style={{
                  display: 'flex', flexWrap: 'wrap',
                  gap: 8, justifyContent: 'center',
                  marginTop: 8, maxWidth: 480,
                }}>
                  {[
                    'Summarize Phase 3 progress',
                    'Identify architectural risks',
                    'Generate test cases for auth flow',
                    'Review deployment checklist',
                  ].map(suggestion => (
                    <button
                      key={suggestion}
                      onClick={() => {
                        setUserInput(suggestion)
                      }}
                      style={{
                        padding: '7px 14px',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 999,
                        background: 'rgba(255,255,255,0.04)',
                        color: 'rgba(255,255,255,0.55)',
                        fontSize: 12, fontWeight: 500,
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor 
                          = accent
                        e.currentTarget.style.color 
                          = accent
                        e.currentTarget.style.background 
                          = hexToRgba(accent, 0.08)
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor 
                          = 'rgba(255,255,255,0.1)'
                        e.currentTarget.style.color 
                          = 'rgba(255,255,255,0.55)'
                        e.currentTarget.style.background 
                          = 'rgba(255,255,255,0.04)'
                      }}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}
  
            {history.map(run => {
              const displayInput = run.input || localInputs[run.id]
              return (
                <div key={run.id} style={{
                  display: 'flex', flexDirection: 'column',
                  gap: 14,
                }}>
                  {displayInput && (
                    <div style={{
                      display: 'flex', gap: 10,
                      alignItems: 'flex-start',
                      flexDirection: 'row-reverse',
                    }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 8,
                        background: hexToRgba(accent, 0.15),
                        border: `1px solid ${hexToRgba(accent, 0.3)}`,
                        display: 'flex', alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        fontSize: 11, fontWeight: 700,
                        color: accent,
                      }}>U</div>
                      <div style={{
                        background: hexToRgba(accent, 0.1),
                        border: `1px solid ${hexToRgba(accent, 0.18)}`,
                        borderRadius: '16px 16px 4px 16px',
                        padding: '10px 14px', maxWidth: '70%',
                        fontSize: 13, color: '#fff',
                        lineHeight: 1.65, whiteSpace: 'pre-wrap',
                      }}>
                        {displayInput}
                      </div>
                    </div>
                  )}
                  {run.output && (
                    <div style={{
                      display: 'flex', gap: 10,
                      alignItems: 'flex-start',
                    }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 8,
                        background: hexToRgba(accent, 0.08),
                        border: `1px solid ${hexToRgba(accent, 0.2)}`,
                        display: 'flex', alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0, fontSize: 13, color: accent,
                      }}>✦</div>
                      <div style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.07)',
                        borderRadius: '16px 16px 16px 4px',
                        padding: '12px 16px', maxWidth: '85%',
                        fontSize: 13,
                        color: 'rgba(255,255,255,0.85)',
                        lineHeight: 1.75,
                      }}>
                        {run.features?.name && (
                          <div style={{
                            fontSize: 9, fontWeight: 800,
                            color: accent, textTransform: 'uppercase',
                            letterSpacing: '0.1em', marginBottom: 8,
                            paddingBottom: 7,
                            borderBottom: `1px solid ${
                              hexToRgba(accent, 0.15)}`,
                          }}>
                            {run.features.name}
                          </div>
                        )}
                        <div className="prose prose-invert 
                          prose-sm max-w-none
                          prose-code:text-[var(--accent-primary)]
                          prose-code:bg-white/5
                          prose-code:px-1.5 prose-code:rounded
                          prose-pre:bg-white/5
                          prose-pre:border prose-pre:border-white/10
                          prose-code:before:content-none
                          prose-code:after:content-none">
                          <ReactMarkdown>
                            {run.output}
                          </ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
  
            {isRunning && (
              <div style={{
                display: 'flex', gap: 10,
                alignItems: 'flex-start',
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: hexToRgba(accent, 0.08),
                  border: `1px solid ${hexToRgba(accent, 0.2)}`,
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0, fontSize: 13, color: accent,
                }}>✦</div>
                <div style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: '16px 16px 16px 4px',
                  padding: '12px 16px', maxWidth: '85%',
                  fontSize: 13,
                  color: 'rgba(255,255,255,0.85)',
                  lineHeight: 1.75, minWidth: 60,
                }}>
                  {output ? (
                    <div className="prose prose-invert prose-sm">
                      <ReactMarkdown>{output}</ReactMarkdown>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 4 }}>
                      {[0, 0.2, 0.4].map((d, i) => (
                        <div key={i} style={{
                          width: 5, height: 5,
                          borderRadius: '50%',
                          background: 'rgba(255,255,255,0.4)',
                          animation: 'agentBounce 1.2s infinite',
                          animationDelay: `${d}s`,
                        }} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
            <div ref={messageEndRef} />
          </div>
  
          {/* Input */}
          <div style={{
            borderTop: '1px solid rgba(255,255,255,0.06)',
            padding: '14px 20px', flexShrink: 0,
            background: 'rgba(0,0,0,0.4)',
          }}>
            {initialPrompt && !output && history.length === 0 && (
              <div style={{
                margin: '0 0 12px',
                padding: '10px 14px',
                background: hexToRgba(accent, 0.08),
                border: `1px solid ${hexToRgba(accent, 0.2)}`,
                borderRadius: 8,
                fontSize: 12,
                color: 'rgba(255,255,255,0.55)',
                lineHeight: 1.5,
              }}>
                <span style={{ 
                  color: accent, fontWeight: 600 
                }}>
                  Prompt loaded from Prompts Studio.
                </span>
                {' '}Review and press Enter to send, 
                or edit before sending.
              </div>
            )}
            {selectedPromptId && !isRunning && 
             history.length === 0 && !output && (
              <div style={{
                margin: '0 20px 8px',
                padding: '8px 14px',
                background: hexToRgba(accent, 0.07),
                border: `1px solid ${hexToRgba(accent, 0.2)}`,
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
              }}>
                <span style={{
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.5)',
                }}>
                  <span style={{ color: accent, fontWeight: 600 }}>
                    Prompt loaded.
                  </span>
                  {' '}Edit or press Enter to run.
                </span>
                <button
                  onClick={() => {
                    setUserInput('')
                    setSelectedPromptId('')
                  }}
                  style={{
                    background: 'transparent', border: 'none',
                    color: 'rgba(255,255,255,0.2)',
                    cursor: 'pointer', fontSize: 14,
                    lineHeight: 1, padding: '0 4px',
                  }}
                >
                  ×
                </button>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <textarea
                value={userInput}
                onChange={e => setUserInput(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleRunAgent()
                  }
                }}
                placeholder={isRunning
                  ? 'Agent is thinking...'
                  : 'Ask anything about your project...'}
                disabled={isRunning}
                style={{
                  flex: 1,
                  background: 'rgba(255,255,255,0.04)',
                  border: `1px solid ${focused
                    ? accent
                    : 'rgba(255,255,255,0.1)'}`,
                  boxShadow: focused ? `0 0 0 3px ${hexToRgba(accent, 0.1)}` : 'none',
                  borderRadius: 8, padding: '10px 14px',
                  fontSize: 13, color: '#fff',
                  outline: 'none', resize: 'none',
                  minHeight: 40, maxHeight: 140,
                  lineHeight: 1.5, fontFamily: 'inherit',
                  transition: 'all 0.2s',
                  opacity: isRunning ? 0.5 : 1,
                }}
              />
              <button
                onClick={handleRunAgent}
                disabled={isRunning || !userInput.trim()}
                style={{
                  width: 40, height: 40,
                  borderRadius: 8, background: accent,
                  border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'center', flexShrink: 0,
                  opacity: (isRunning || !userInput.trim())
                    ? 0.3 : 1,
                  transition: 'opacity 0.2s',
                }}
              >
                <ArrowUp size={16} color="#000" />
              </button>
            </div>
            <div style={{
              fontSize: 10, marginTop: 5,
              color: 'rgba(255,255,255,0.12)',
              textAlign: 'center',
            }}>
              Enter to send · Shift+Enter new line
              · Full context injected automatically
            </div>
          </div>
        </div>
  
        {/* RIGHT PANEL — Context Injected */}
        <div style={{
          width: 240, flexShrink: 0,
          borderLeft: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}>
            <div style={{
              padding: '12px 16px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              fontSize: 11, fontWeight: 500,
              letterSpacing: '0.03em', textTransform: 'none',
              color: 'rgba(255,255,255,0.35)',
            }}>
              Context sent to agent
            </div>
          <div style={{
            flex: 1, overflowY: 'auto',
            padding: '12px 14px',
          }}>
            {/* Context files injected */}
            <div style={{
              fontSize: 11, fontWeight: 500,
              color: 'rgba(255,255,255,0.35)',
              letterSpacing: '0.03em',
              textTransform: 'none', marginBottom: 10,
            }}>
              Injected files
            </div>
            {[
              'context/architecture.md',
              'context/coding-guidelines.md',
              'context/ai-governance.md',
              'context/tech-stack.md',
            ].map(file => (
              <div key={file} style={{
                display: 'flex', alignItems: 'center',
                gap: 7, padding: '6px 0',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
              }}>
                <span style={{
                  fontSize: 10, color: '#10b981',
                  flexShrink: 0,
                }}>✓</span>
                <span style={{
                  fontSize: 10, fontFamily: 'monospace',
                  color: 'rgba(255,255,255,0.4)',
                }}>
                  {file}
                </span>
              </div>
            ))}
  
            {/* Token usage */}
            <div style={{
              marginTop: 16,
              paddingTop: 16,
              borderTop: '1px solid rgba(255,255,255,0.06)',
            }}>
              <div style={{
                fontSize: 9, fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.25)',
                marginBottom: 10,
              }}>
                Token Usage
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: 6,
              }}>
                <span style={{
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.35)',
                }}>
                  Context
                </span>
                <span style={{
                  fontSize: 11, fontFamily: 'monospace',
                  color: accent, fontWeight: 700,
                }}>
                  {history.length > 0 && history[0]?.output
                    ? Math.floor(
                        (history[0].output.length || 0) / 4
                      ).toLocaleString()
                    : '—'
                  }
                </span>
              </div>
              {/* Token bar */}
              <div style={{
                height: 4,
                background: 'rgba(255,255,255,0.07)',
                borderRadius: 999, overflow: 'hidden',
                marginBottom: 6,
              }}>
                <div style={{
                  height: '100%',
                  width: history[0]?.output
                    ? `${Math.min(
                        (Math.floor(
                          (history[0].output.length||0)/4
                        ) / 8000) * 100, 100
                      )}%`
                    : '28%',
                  background: accent,
                  borderRadius: 999,
                }} />
              </div>
              <div style={{
                fontSize: 10,
                color: 'rgba(255,255,255,0.2)',
                fontFamily: 'monospace',
              }}>
                28% of 8k context window
              </div>
            </div>
  
            {/* Selected feature */}
            {selectedFeatureId && features.find(
              f => f.id === selectedFeatureId
            ) && (
              <div style={{ marginTop: 16 }}>
                <div style={{
                  fontSize: 11, fontWeight: 500,
                  color: 'rgba(255,255,255,0.35)',
                  letterSpacing: '0.03em',
                  textTransform: 'none',
                  marginBottom: 8,
                }}>
                  Feature scope
                </div>
                <div style={{
                  background: hexToRgba(accent, 0.07),
                  border: `1px solid ${hexToRgba(accent, 0.2)}`,
                  borderRadius: 8, padding: '8px 10px',
                  fontSize: 11, color: accent, fontWeight: 600,
                }}>
                  {features.find(
                    f => f.id === selectedFeatureId
                  )?.name}
                </div>
              </div>
            )}
  
            {/* Token estimate */}
            {history.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{
                  fontSize: 11, fontWeight: 500,
                  color: 'rgba(255,255,255,0.35)',
                  letterSpacing: '0.03em',
                  textTransform: 'none', marginBottom: 8,
                }}>
                  Last run
                </div>
                <div style={{
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.4)',
                  lineHeight: 1.6,
                }}>
                  Model: {' '}
                  <span style={{ color: accent }}>
                    {history[0]?.model_used}
                  </span>
                </div>
                {history[0]?.output && (
                  <div style={{
                    fontSize: 11,
                    color: 'rgba(255,255,255,0.4)',
                    marginTop: 4,
                  }}>
                    ~{Math.floor(
                      (history[0].output.length || 0) / 4
                    ).toLocaleString()} tokens
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
  
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes agentBounce {
          0%, 80%, 100% { 
            transform: scale(0.6); opacity: 0.4; 
          }
          40% { transform: scale(1); opacity: 1; }
        }
        @keyframes agentPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
      `}} />
    </div>
  )
}

export default function AgentRunnerPage() {
  return <Suspense fallback={<div style={{ flex: 1, background: '#000' }} />}><AgentRunnerContent /></Suspense>
}
