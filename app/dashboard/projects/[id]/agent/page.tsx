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

  const [project, setProject] = useState<{name: string} | null>(null)

  const [history, setHistory] = useState<AgentRun[]>([])
  const [loading, setLoading] = useState(true)

  const [selectedFeatureId] = useState(initialFeatureId || '')
  const [selectedProvider] = useState('mistral')
  const [selectedModel] = useState('mistral-small-latest')
  
  const [output, setOutput] = useState('')
  const [userInput, setUserInput] = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const [focused, setFocused] = useState(false)

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
      const { data: proj } = await supabase.from('projects').select('name').eq('id', projectId).single()
      if (proj) setProject(proj)
      loadHistory()
    }
    init()
  }, [projectId, loadHistory])

  useEffect(() => {
    if (messageEndRef.current) messageEndRef.current.scrollIntoView({ behavior: 'smooth' })
  }, [output, history])

  const handleRunAgent = async () => {
    if ((!selectedFeatureId && !userInput) || isRunning) return

    setIsRunning(true)
    const prompt = userInput
    setUserInput('')
    setOutput('')
    
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
    } catch (err) { toast.error(err instanceof Error ? err.message : String(err)) }
    finally { setIsRunning(false) }
  }

  const handleClearHistory = async () => {
    // Keep logic for clearing history if exists, or just ui for now
    toast.info('History archival initialized')
  }

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 24, gap: 16 }}>
      <div style={{ height: 40, background: 'rgba(255,255,255,0.05)', borderRadius: 8, width: '40%' }} />
      <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', borderRadius: 12 }} />
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 104px)', background: '#000' }}>
      <title>{`Reminisce — Agent — ${project?.name}`}</title>
      
      {/* HEADER BAR */}
      <div style={{ 
        padding: '16px 24px', 
        borderBottom: '1px solid rgba(255,255,255,0.06)', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        background: 'rgba(0,0,0,0.5)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>
            AGENT MODE
          </span>
          <div style={{ 
            marginLeft: 12, 
            background: hexToRgba(accent, 0.1), 
            border: `1px solid ${hexToRgba(accent, 0.2)}`, 
            borderRadius: 999, 
            padding: '3px 10px', 
            fontSize: 10, 
            color: accent, 
            fontWeight: 700 
          }}>
            {selectedModel.toUpperCase()}
          </div>
        </div>

        <button 
          onClick={handleClearHistory}
          style={{ 
            background: 'transparent', 
            border: 'none', 
            fontSize: 10, 
            color: 'rgba(255,255,255,0.3)', 
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.3)'}
        >
          <Trash2 size={12} /> CLEAR_HISTORY
        </button>
      </div>

      {/* MESSAGE AREA */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {history.map((run) => (
          <div key={run.id} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
             {/* User Input Mockup if we had it, otherwise just show AI response */}
             <div style={{
               alignSelf: 'flex-start',
               maxWidth: '85%',
               background: 'rgba(255,255,255,0.04)',
               border: '1px solid rgba(255,255,255,0.08)',
               borderRadius: '12px 12px 12px 2px',
               padding: '12px 16px',
               fontSize: 14,
               color: 'rgba(255,255,255,0.85)',
               lineHeight: 1.7
             }}>
               <div style={{ fontSize: 10, fontWeight: 800, color: accent, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                 {run.features?.name || 'SYSTEM_CORE'}
               </div>
               <div className="prose prose-invert prose-sm max-w-none">
                 <ReactMarkdown>{run.output || ''}</ReactMarkdown>
               </div>
             </div>
          </div>
        ))}
        
        {isRunning && (
          <div style={{
            alignSelf: 'flex-start',
            maxWidth: '85%',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '12px 12px 12px 2px',
            padding: '12px 16px',
            fontSize: 14,
            color: 'rgba(255,255,255,0.85)',
            lineHeight: 1.7
          }}>
            <div className="prose prose-invert prose-sm max-w-none">
              <ReactMarkdown>{output}</ReactMarkdown>
            </div>
            <div style={{ display: 'flex', gap: 4, marginTop: 12 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.4)', animation: 'bounce 1.2s infinite' }} />
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.4)', animation: 'bounce 1.2s infinite 0.2s' }} />
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.4)', animation: 'bounce 1.2s infinite 0.4s' }} />
            </div>
          </div>
        )}
        <div ref={messageEndRef} />
      </div>

      {/* INPUT AREA */}
      <div style={{ 
        borderTop: '1px solid rgba(255,255,255,0.06)', 
        padding: '16px 24px', 
        display: 'flex', 
        gap: 12, 
        alignItems: 'flex-end',
        background: 'rgba(0,0,0,0.3)'
      }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <textarea
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleRunAgent() } }}
            placeholder="Direct mission commands..."
            style={{
              width: '100%',
              background: 'rgba(255,255,255,0.04)',
              border: `1px solid ${focused ? accent : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 10,
              padding: '12px 16px',
              fontSize: 14,
              color: '#fff',
              outline: 'none',
              resize: 'none',
              minHeight: 44,
              maxHeight: 200,
              lineHeight: 1.6,
              transition: 'border-color 0.2s'
            }}
          />
        </div>
        <button
          onClick={handleRunAgent}
          disabled={isRunning || (!userInput && !selectedFeatureId)}
          style={{
            width: 40,
            height: 40,
            borderRadius: 8,
            background: accent,
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            opacity: (isRunning || !userInput) ? 0.4 : 1,
            transition: 'opacity 0.2s'
          }}
          onMouseEnter={(e) => { if (!isRunning && userInput) e.currentTarget.style.opacity = '0.85' }}
          onMouseLeave={(e) => { if (!isRunning && userInput) e.currentTarget.style.opacity = '1' }}
        >
          <ArrowUp size={18} color="#000" />
        </button>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1.0); }
        }
      `}} />
    </div>
  )
}

export default function AgentRunnerPage() {
  return <Suspense fallback={<div style={{ flex: 1, background: '#000' }} />}><AgentRunnerContent /></Suspense>
}
