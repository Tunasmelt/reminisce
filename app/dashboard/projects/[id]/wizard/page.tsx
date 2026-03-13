'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'

import { 
  Sparkles
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { useTheme } from '@/hooks/useTheme'

type Message = { role: 'user' | 'assistant' | 'system', content: string }

function hexToRgba(hex: string, a: number) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

export default function WizardPage() {
  const params = useParams()
  const { accent } = useTheme()
  const projectId = params.id as string
  const { session } = useAuthStore()
  
  const [project, setProject] = useState<{name: string} | null>(null)
  const [loading, setLoading] = useState(true)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMsg, setInputMsg] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  
  const [selectedProvider] = useState('mistral')
  const [selectedModel] = useState('mistral-small-latest')
  
  const [generatedData, setGeneratedData] = useState<unknown>(null)

  useEffect(() => {
    const init = async () => {
      const [{ data: proj }, { data: sessions }] = await Promise.all([
        supabase.from('projects').select('name').eq('id', projectId).single(),
        supabase.from('wizard_sessions')
          .select('*')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false })
          .limit(1)
      ])
      
      if (proj) setProject(proj)
      
      if (sessions && sessions.length > 0) {
        const sess = sessions[0]
        setSessionId(sess.id)
        const chatMsgs = (sess.messages || []).filter((m: Message) => m.role !== 'system')
        setMessages(chatMsgs)
      }
      setLoading(false)
    }
    init()
  }, [projectId])

  const handleSendMessage = async () => {
    if (!inputMsg.trim()) return
    const currentInput = inputMsg
    setInputMsg('')
    setMessages(prev => [...prev, { role: 'user', content: currentInput }])
    setIsTyping(true)
    
    try {
      const res = await fetch('/api/wizard/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ 
          sessionId, 
          projectId, 
          message: currentInput,
          provider: selectedProvider,
          model: selectedModel
        })
      })

      if (!res.ok) throw new Error('Communication failed')
      
      const newSessionId = res.headers.get('X-Session-Id')
      if (newSessionId && !sessionId) setSessionId(newSessionId)

      setMessages(prev => [...prev, { role: 'assistant', content: '' }])

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let assistantMsg = ''
      let buffer = ''

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''
          for (const line of lines) {
            const trimmed = line.trim()
            if (trimmed.startsWith('data: ') && trimmed !== 'data: [DONE]') {
              try {
                const data = JSON.parse(trimmed.slice(6))
                if (data.choices?.[0]?.delta?.content) {
                  assistantMsg += data.choices[0].delta.content
                  setMessages(prev => {
                    const newArr = [...prev]
                    newArr[newArr.length - 1].content = assistantMsg
                    return newArr
                  })
                }
              } catch { }
            }
          }
        }
      }
    } catch {
      toast.error('Transmission failure')
    } finally {
      setIsTyping(false)
    }
  }

  const handleGenerate = async () => {
    if (!sessionId) return
    setIsGenerating(true)
    try {
      const res = await fetch('/api/wizard/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ sessionId, projectId, provider: selectedProvider, model: selectedModel })
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setGeneratedData(data)
      toast.success('Blueprint Generated')
    } catch {
      toast.error('Generation failed')
    } finally {
      setIsGenerating(false)
    }
  }

  const lastMsg = messages[messages.length - 1]
  const isReady = lastMsg?.role === 'assistant' && lastMsg.content.includes('[READY_TO_GENERATE]')
  const stepCount = 5
  const currentStep = Math.min(Math.floor(messages.length / 2) + 1, stepCount)

  if (loading) return <div style={{ padding: 48, background: '#000', color: '#fff' }}>Initializing Wizard...</div>

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 32px' }}>
      <title>{`Reminisce — Wizard — ${project?.name}`}</title>
      
      {/* STEP PROGRESS BAR */}
      <div style={{ display: 'flex', width: '100%', height: 2, background: 'rgba(255,255,255,0.1)', marginBottom: 64 }}>
        {[...Array(stepCount)].map((_, i) => (
          <div key={i} style={{ 
            flex: 1, 
            height: '100%', 
            background: i < currentStep ? accent : 'transparent',
            transition: 'background 0.4s'
          }} />
        ))}
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        {/* Step Card */}
        <div style={{
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 16,
          background: 'rgba(255,255,255,0.02)',
          padding: 48,
          position: 'relative'
        }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: accent, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 24 }}>
            STEP_0{currentStep}
          </div>

          {!generatedData ? (
            <>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', marginBottom: 32, lineHeight: 1.4 }}>
                {messages.length === 0 
                  ? "Describe the core purpose and high-level architecture of your mission domain." 
                  : (isTyping ? "Processing architectural directives..." : (lastMsg?.role === 'assistant' ? lastMsg.content.replace('[READY_TO_GENERATE]', '') : "Awaiting further specification..."))
                }
              </h1>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <textarea
                  value={inputMsg}
                  onChange={(e) => setInputMsg(e.target.value)}
                  placeholder="Type your architectural intent here..."
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 12,
                    padding: 24,
                    fontSize: 14,
                    color: '#fff',
                    outline: 'none',
                    minHeight: 160,
                    resize: 'none',
                    lineHeight: 1.6
                  }}
                />

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                  {isReady && !isGenerating && (
                    <button 
                      onClick={handleGenerate}
                      style={{
                        background: accent,
                        color: '#000',
                        border: 'none',
                        borderRadius: 999,
                        padding: '12px 32px',
                        fontSize: 11,
                        fontWeight: 800,
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        cursor: 'pointer'
                      }}
                    >
                      GENERATE BLUEPRINT →
                    </button>
                  )}
                  <button 
                    onClick={handleSendMessage}
                    disabled={isTyping || isGenerating || !inputMsg.trim()}
                    style={{
                      background: accent,
                      color: '#000',
                      border: 'none',
                      borderRadius: 999,
                      padding: '12px 32px',
                      fontSize: 11,
                      fontWeight: 800,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      opacity: (isTyping || isGenerating || !inputMsg.trim()) ? 0.4 : 1
                    }}
                  >
                    NEXT →
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: hexToRgba(accent, 0.1), border: `1px solid ${accent}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                <Sparkles size={32} color={accent} />
              </div>
              <h2 style={{ fontSize: 24, fontWeight: 800, color: '#fff', marginBottom: 16 }}>BLUEPRINT_READY</h2>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', marginBottom: 32 }}>Mission domain successfully orchestrated. Review assets in Overview or Context Engine.</p>
              <Link href={`/dashboard/projects/${projectId}`} style={{
                display: 'inline-block',
                background: accent,
                color: '#000',
                textDecoration: 'none',
                borderRadius: 999,
                padding: '12px 32px',
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: '0.1em',
                textTransform: 'uppercase'
              }}>
                RETURN_TO_MAINFRAME
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
