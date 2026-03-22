'use client'

import { useState, useEffect, useRef } from 'react'
import CustomSelect from '@/components/CustomSelect'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'

import { ArrowUp, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { useTheme } from '@/hooks/useTheme'
import { useFileSystem } from '@/hooks/useFileSystem'

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
  const [rightTab, setRightTab] = useState<'preview' | 'prompts' | 'files'>('preview')
  const [collectedAnswers, setCollectedAnswers] = useState<Record<string, string>>({})
  
  const [selectedProvider, setSelectedProvider] = useState('openrouter')
  const [selectedModel, setSelectedModel] = useState('meta-llama/llama-3.3-70b-instruct:free')
  const initialized = useRef(false)

  const { isConnected, writeFile, initProject } = useFileSystem()

  const WIZARD_MODELS = [
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
  
  interface GeneratedBlueprint {
    architecture?: string
    techStack?: {
      frontend?: string
      backend?: string
      database?: string
    }
    phases?: Array<{
      name: string
      description: string
      features?: Array<{
        name: string
        description: string
        type?: string
      }>
    }>
    markdownFiles?: Record<string, string>
  }
  const [generatedData, setGeneratedData] = useState<GeneratedBlueprint | null>(null)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

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
        
        const uniqueMsgs = chatMsgs.filter(
          (msg: Message, idx: number, arr: Message[]) =>
            arr.findIndex(
              m => m.role === msg.role && 
                   m.content === msg.content
            ) === idx
        )
        setMessages(uniqueMsgs)
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

      // ── EXTRACTION LOGIC ──
      const lastAI = assistantMsg || ''
      const newAnswers = { ...collectedAnswers }
      
      if (lastAI.toLowerCase().includes('react') || lastAI.toLowerCase().includes('next')) {
        newAnswers['Tech stack'] = 'React / Next.js'
      }
      if (lastAI.toLowerCase().includes('vercel')) {
        newAnswers['Deployment'] = 'Vercel'
      }
      if (lastAI.toLowerCase().includes('mongodb') || lastAI.toLowerCase().includes('postgres') || lastAI.toLowerCase().includes('supabase')) {
        newAnswers['Database'] = lastAI.toLowerCase().includes('mongodb') ? 'MongoDB' : lastAI.toLowerCase().includes('supabase') ? 'Supabase' : 'PostgreSQL'
      }
      
      const userMsgs = [...messages, { role: 'user', content: currentInput }].filter(m => m.role === 'user')
      userMsgs.forEach(msg => {
        const lower = msg.content.toLowerCase()
        if (lower.includes('week') || lower.includes('month')) {
          newAnswers['Timeline'] = msg.content
        }
        if (lower.includes('beginner') || lower.includes('junior') || lower.includes('senior')) {
          newAnswers['Difficulty'] = msg.content
        }
      })
      
      if (Object.keys(newAnswers).length > 0) {
        setCollectedAnswers(newAnswers)
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

      // Write files to local disk if folder connected
      if (isConnected && data.markdownFiles) {
        try {
          // Initialize folder structure first
          await initProject()
          
          // Write each generated file
          const fileEntries = Object.entries(
            data.markdownFiles as Record<string, string>
          )
          let written = 0
          for (const [filePath, content] of fileEntries) {
            try {
              await writeFile(
                `reminisce/${filePath}`, 
                content
              )
              written++
            } catch (fileErr) {
              console.warn(`Could not write ${filePath}:`, fileErr)
            }
          }
          if (written > 0) {
            toast.success(
              `${written} files written to local folder`
            )
          }
        } catch (fsErr) {
          console.warn('Local write failed:', fsErr)
          // Non-fatal — generation still succeeded
        }
      }
    } catch {
      toast.error('Generation failed')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleExportZip = async () => {
    if (!generatedData?.markdownFiles) return
    try {
      const { data: { session: s } } = await supabase.auth.getSession()
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${s?.access_token}`
        },
        body: JSON.stringify({
          projectId,
          files: generatedData.markdownFiles
        })
      })
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `reminisce-${projectId}.zip`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('ZIP exported successfully')
    } catch {
      toast.error('Export failed')
    }
  }

  const userMessageCount = messages.filter(m => m.role === 'user').length
  const lastMsg = messages[messages.length - 1]
  const isReady = userMessageCount >= 3 || (
    lastMsg?.role === 'assistant' && lastMsg.content.includes('[READY_TO_GENERATE]')
  )

  useEffect(() => {
    document.getElementById('wizard-bottom')
      ?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  if (loading) return <div style={{ padding: 48, background: '#000', color: '#fff' }}>Initializing Wizard...</div>

  return (
    <div style={{
      display: 'flex',
      height: 'calc(100vh - 104px)',
      background: '#000',
      overflow: 'hidden',
    }}>
  
      {/* ══════════════════════════════
          LEFT PANEL — Chat
      ══════════════════════════════ */}
      <div style={{
        width: '50%',
        minWidth: 400,
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid rgba(255,255,255,0.06)',
      }}>
  
        {/* Header */}
        <div style={{
          padding: '0 24px',
          height: 52,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', 
                        alignItems: 'center', gap: 10 }}>
            <span style={{
              fontSize: 11, fontWeight: 500,
              letterSpacing: '0.03em',
              textTransform: 'none',
              color: 'rgba(255,255,255,0.35)',
            }}>
              Project Wizard
            </span>
            {project && (
              <span style={{
                fontSize: 10, fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 999,
                background: hexToRgba(accent, 0.1),
                border: `1px solid ${hexToRgba(accent, 0.25)}`,
                color: accent,
                letterSpacing: '0.06em',
              }}>
                {project.name}
              </span>
            )}
          </div>
          <div style={{ flex: 1 }} />
          <CustomSelect
            value={selectedModel}
            onChange={val => {
              const m = WIZARD_MODELS.find(x => x.model === val)
              if (m) {
                setSelectedModel(m.model)
                setSelectedProvider(m.provider)
              }
            }}
            options={WIZARD_MODELS.map(m => ({
              value: m.model,
              label: m.free 
                ? `${m.label} ★` 
                : m.label,
            }))}
            width={160}
            compact
          />
          <div style={{ width: 16 }} />
          <span style={{
            fontSize: 10, fontFamily: 'monospace',
            color: 'rgba(255,255,255,0.2)',
          }}>
            {userMessageCount < 5 
              ? `${5 - userMessageCount} more suggested`
              : 'Ready to generate'}
          </span>
        </div>
  
        {/* Progress bar */}
        <div style={{
          height: 2,
          background: 'rgba(255,255,255,0.05)',
          flexShrink: 0,
        }}>
          <div style={{
            height: '100%',
            width: `${Math.min(
              (messages.filter(m => 
                m.role === 'user').length / 5) 
              * 100, 100
            )}%`,
            background: accent,
            transition: 'width 0.5s ease',
            borderRadius: '0 999px 999px 0',
          }} />
        </div>
  
        {/* Messages */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}>
          {/* Welcome message */}
          {messages.length === 0 && !loading && (
            <div style={{
              display: 'flex', gap: 10,
              alignItems: 'flex-start',
            }}>
              <div style={{
                width: 30, height: 30,
                borderRadius: 8,
                background: hexToRgba(accent, 0.1),
                border: `1px solid ${hexToRgba(accent, 0.25)}`,
                display: 'flex', alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0, fontSize: 14,
              }}>✦</div>
              <div style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '16px 16px 16px 4px',
                padding: '12px 16px', maxWidth: '85%',
              }}>
                <p style={{
                  fontSize: 14, color: '#fff',
                  margin: 0, lineHeight: 1.6,
                }}>
                  Welcome. Describe your project idea 
                  and I&apos;ll help you architect it.
                </p>
                <p style={{
                  fontSize: 12,
                  color: 'rgba(255,255,255,0.4)',
                  margin: '6px 0 0', lineHeight: 1.5,
                }}>
                  I&apos;ll ask about your users, features, 
                  stack, and timeline — then generate 
                  a complete blueprint.
                </p>
              </div>
            </div>
          )}
  
          {/* Message bubbles */}
          {messages
            .filter(m => m.role !== 'system')
            .map((msg, i) => {
              const isUser = msg.role === 'user'
              const content = msg.content
                .replace('[READY_TO_GENERATE]', '')
                .trim()
              return (
                <div key={i} style={{
                  display: 'flex', gap: 10,
                  alignItems: 'flex-start',
                  flexDirection: isUser 
                    ? 'row-reverse' : 'row',
                }}>
                  <div style={{
                    width: 28, height: 28,
                    borderRadius: 7,
                    background: isUser
                      ? hexToRgba(accent, 0.15)
                      : 'rgba(255,255,255,0.06)',
                    border: isUser
                      ? `1px solid ${hexToRgba(accent, 0.3)}`
                      : '1px solid rgba(255,255,255,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0, fontSize: 11,
                    fontWeight: 700,
                    color: isUser 
                      ? accent 
                      : 'rgba(255,255,255,0.5)',
                  }}>
                    {isUser ? 'U' : '✦'}
                  </div>
                  <div style={{
                    background: isUser
                      ? hexToRgba(accent, 0.1)
                      : 'rgba(255,255,255,0.04)',
                    border: isUser
                      ? `1px solid ${hexToRgba(accent, 0.18)}`
                      : '1px solid rgba(255,255,255,0.07)',
                    borderRadius: isUser
                      ? '12px 12px 2px 12px'
                      : '12px 12px 12px 2px',
                    padding: '10px 14px',
                    maxWidth: '80%',
                    fontSize: 13,
                    color: isUser 
                      ? '#fff' 
                      : 'rgba(255,255,255,0.85)',
                    lineHeight: 1.65,
                    whiteSpace: 'pre-wrap',
                  }}>
                    {content}
                  </div>
                </div>
              )
            })
          }
  
          {/* Typing indicator */}
          {isTyping && (
            <div style={{
              display: 'flex', gap: 10,
              alignItems: 'flex-start',
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                display: 'flex', alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0, fontSize: 14,
                color: 'rgba(255,255,255,0.5)',
              }}>✦</div>
              <div style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: '16px 16px 16px 4px',
                padding: '12px 16px',
                display: 'flex', gap: 5,
                alignItems: 'center',
              }}>
                {[0, 0.2, 0.4].map((d, i) => (
                  <div key={i} style={{
                    width: 5, height: 5,
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.4)',
                    animation: 'wBounce 1.2s infinite',
                    animationDelay: `${d}s`,
                  }} />
                ))}
              </div>
            </div>
          )}
  
          <div id="wizard-bottom" />
        </div>
  
        {/* Input area */}
        {!generatedData && (
          <div style={{
            borderTop: '1px solid rgba(255,255,255,0.06)',
            padding: '14px 20px',
            flexShrink: 0,
            background: 'rgba(0,0,0,0.4)',
          }}>
            {isReady && !isGenerating && (
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                marginBottom: 10,
              }}>
                <button
                  onClick={handleGenerate}
                  style={{
                    display: 'flex',
                    alignItems: 'center', gap: 6,
                    background: accent, color: '#000',
                    border: 'none', borderRadius: 999,
                    padding: '9px 24px',
                    fontSize: 11, fontWeight: 800,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                  }}
                >
                  <Sparkles size={13} />
                  Generate Blueprint
                </button>
              </div>
            )}
            {isGenerating && (
              <div style={{
                textAlign: 'center', fontSize: 11,
                color: accent, fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                padding: '6px 0',
                marginBottom: 8,
                animation: 'wPulse 2s infinite',
              }}>
                Generating blueprint...
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <textarea
                value={inputMsg}
                onChange={e => setInputMsg(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    if (!isTyping && !isGenerating 
                        && inputMsg.trim()) {
                      handleSendMessage()
                    }
                  }
                }}
                placeholder={
                  isTyping ? 'Waiting...'
                  : isReady 
                    ? 'Add more detail or generate...'
                    : 'Describe your project...'
                }
                disabled={isTyping || isGenerating}
                style={{
                  flex: 1,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  padding: '10px 14px',
                  fontSize: 13, color: '#fff',
                  outline: 'none', resize: 'none',
                  minHeight: 40, maxHeight: 120,
                  lineHeight: 1.5,
                  fontFamily: 'inherit',
                  transition: 'all 0.2s',
                  opacity: (isTyping || isGenerating) 
                    ? 0.5 : 1,
                }}
                onFocus={e => {
                  e.currentTarget.style.borderColor = accent
                  e.currentTarget.style.boxShadow = `0 0 0 3px ${hexToRgba(accent, 0.1)}`
                }}
                onBlur={e => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              />
              <button
                onClick={handleSendMessage}
                disabled={isTyping || isGenerating 
                          || !inputMsg.trim()}
                style={{
                  width: 40, height: 40,
                  borderRadius: 8, background: accent,
                  border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'center', flexShrink: 0,
                  opacity: (isTyping || isGenerating 
                            || !inputMsg.trim()) 
                    ? 0.3 : 1,
                }}
              >
                <ArrowUp size={16} color="#000" />
              </button>
            </div>
            <div style={{
              fontSize: 10, marginTop: 6,
              color: 'rgba(255,255,255,0.15)',
              textAlign: 'center',
            }}>
              Enter to send · Shift+Enter new line
            </div>
          </div>
        )}
      </div>
  
      {/* ══════════════════════════════
          RIGHT PANEL — Live Preview
      ══════════════════════════════ */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
      }}>
  
        {/* Right panel header + tabs */}
        <div style={{
          height: 52,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          flexShrink: 0,
        }}>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 0 }}>
            {(['preview', 'prompts', 'files'] as const)
              .map(tab => (
              <button
                key={tab}
                onClick={() => setRightTab(tab)}
                style={{
                  padding: '6px 16px',
                  fontSize: 11, fontWeight: 600,
                  letterSpacing: 'normal',
                  textTransform: 'none',
                  border: 'none', background: 'transparent',
                  borderBottom: `2px solid ${
                    rightTab === tab 
                      ? accent 
                      : 'transparent'
                  }`,
                  color: rightTab === tab
                    ? accent
                    : 'rgba(255,255,255,0.35)',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
  
          {/* Generate button in header */}
          {!generatedData && userMessageCount >= 3 && !isGenerating && (
            <button
              onClick={handleGenerate}
              style={{
                display: 'flex',
                alignItems: 'center', gap: 6,
                padding: '6px 14px',
                background: accent,
                color: '#000',
                border: 'none',
                borderRadius: 8,
                fontSize: 10, fontWeight: 800,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              <Sparkles size={12} />
              Generate
            </button>
          )}

          {isGenerating && (
            <div style={{
              fontSize: 10, fontWeight: 700,
              color: accent, letterSpacing: '0.08em',
              textTransform: 'uppercase',
              animation: 'wPulse 2s infinite',
            }}>
              Generating...
            </div>
          )}

          {/* Export ZIP button — only when generated */}
          {generatedData?.markdownFiles && (
            <button
              onClick={handleExportZip}
              style={{
                display: 'flex', alignItems: 'center',
                gap: 6, padding: '6px 14px',
                border: `1px solid rgba(255,255,255,0.1)`,
                borderRadius: 8, background: 'transparent',
                color: 'rgba(255,255,255,0.5)',
                fontSize: 10, fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = accent
                e.currentTarget.style.color = accent
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 
                  'rgba(255,255,255,0.1)'
                e.currentTarget.style.color = 
                  'rgba(255,255,255,0.5)'
              }}
            >
              ↓ Export ZIP
            </button>
          )}
        </div>
  
        {/* Right panel content */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: 24,
        }}>
  
          {/* ── PREVIEW TAB ── */}
          {rightTab === 'preview' && (
            <div style={{
              display: 'flex', flexDirection: 'column',
              gap: 20,
            }}>
              {!generatedData && messages.length === 0 && (
                <div style={{
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  height: 300, gap: 14,
                  opacity: 0.35,
                }}>
                  <div style={{ fontSize: 40 }}>✦</div>
                  <div style={{
                    fontSize: 12, fontWeight: 700,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: 'rgba(255,255,255,0.6)',
                  }}>
                    Blueprint will appear here
                  </div>
                  <div style={{
                    fontSize: 12,
                    color: 'rgba(255,255,255,0.3)',
                    textAlign: 'center', maxWidth: 240,
                  }}>
                    Architecture, tech stack, and phases 
                    will form as you chat
                  </div>
                </div>
              )}
  
              {/* Live preview / Ready card */}
              {!generatedData && messages.length > 0 && (
                <div style={{
                  background: userMessageCount >= 3
                    ? hexToRgba(accent, 0.06)
                    : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${userMessageCount >= 3
                    ? hexToRgba(accent, 0.2)
                    : 'rgba(255,255,255,0.06)'}`,
                  borderRadius: 10, padding: 20,
                  transition: 'all 0.3s',
                }}>
                  <div style={{
                    fontSize: 10, fontWeight: 700,
                    letterSpacing: '0.1em',
                    color: userMessageCount >= 3 
                      ? accent 
                      : 'rgba(255,255,255,0.3)',
                    textTransform: 'uppercase',
                    marginBottom: 8,
                  }}>
                    {userMessageCount >= 3
                      ? '✓ Ready to generate'
                      : 'Conversation in progress'}
                  </div>
                  <div style={{
                    fontSize: 12,
                    color: 'rgba(255,255,255,0.4)',
                    lineHeight: 1.6, marginBottom: 12,
                  }}>
                    {userMessageCount} responses collected.
                    {userMessageCount < 3
                      ? ` ${3 - userMessageCount} more recommended.`
                      : ' Click Generate to build your blueprint.'}
                  </div>
                  {userMessageCount >= 3 && !isGenerating && (
                    <button
                      onClick={handleGenerate}
                      style={{
                        width: '100%',
                        background: accent,
                        color: '#000',
                        border: 'none',
                        borderRadius: 8,
                        padding: '10px',
                        fontSize: 11, fontWeight: 800,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                      }}
                      onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                      onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                    >
                      <Sparkles size={13} />
                      Generate Blueprint
                    </button>
                  )}
                  {isGenerating && (
                    <div style={{
                      textAlign: 'center',
                      fontSize: 11, color: accent,
                      fontWeight: 700, letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      animation: 'wPulse 2s infinite',
                    }}>
                      Generating blueprint...
                    </div>
                  )}
                </div>
              )}

              {/* Collected answers monitor */}
              {!generatedData && Object.keys(collectedAnswers).length > 0 && (
                <div>
                  <div style={{
                    fontSize: 9, fontWeight: 700,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: 'rgba(255,255,255,0.25)',
                    marginBottom: 10,
                  }}>
                    Collected Answers
                  </div>
                  <div style={{
                    display: 'flex', flexDirection: 'column',
                    gap: 1,
                  }}>
                    {Object.entries(collectedAnswers)
                      .map(([key, val]) => (
                      <div key={key} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 12px',
                        background: 'rgba(255,255,255,0.03)',
                        borderRadius: 6,
                      }}>
                        <span style={{
                          fontSize: 11,
                          color: 'rgba(255,255,255,0.35)',
                        }}>
                          {key}
                        </span>
                        <span style={{
                          fontSize: 11, fontWeight: 600,
                          color: 'rgba(255,255,255,0.7)',
                          textAlign: 'right',
                          maxWidth: '60%',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {val}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
  
              {/* Generated blueprint */}
              {generatedData && (
                <>
                  {/* Architecture */}
                  {generatedData.architecture && (
                    <div>
                      <div style={{
                        fontSize: 10, fontWeight: 700,
                        color: accent, letterSpacing: '0.1em',
                        textTransform: 'uppercase', marginBottom: 8,
                      }}>
                        Architecture
                      </div>
                      <div style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.07)',
                        borderRadius: 8, padding: '12px 16px',
                        fontSize: 13,
                        color: 'rgba(255,255,255,0.7)',
                        lineHeight: 1.65,
                      }}>
                        {generatedData.architecture}
                      </div>
                    </div>
                  )}
  
                  {/* Tech stack */}
                  {generatedData.techStack && (
                    <div>
                      <div style={{
                        fontSize: 10, fontWeight: 700,
                        color: accent, letterSpacing: '0.1em',
                        textTransform: 'uppercase', marginBottom: 8,
                      }}>
                        Tech Stack
                      </div>
                      <div style={{
                        display: 'flex', gap: 8,
                        flexWrap: 'wrap',
                      }}>
                        {Object.entries(generatedData.techStack)
                          .map(([key, val]) => val && (
                          <div key={key} style={{
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: 6,
                            padding: '6px 12px',
                            fontSize: 11,
                          }}>
                            <span style={{
                              color: 'rgba(255,255,255,0.35)',
                              fontSize: 9, fontWeight: 700,
                              letterSpacing: '0.08em',
                              textTransform: 'uppercase',
                              display: 'block', marginBottom: 2,
                            }}>
                              {key}
                            </span>
                            <span style={{ color: '#fff' }}>
                              {val}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
  
                  {/* Phases */}
                  {generatedData.phases && 
                   generatedData.phases.length > 0 && (
                    <div>
                      <div style={{
                        fontSize: 10, fontWeight: 700,
                        color: accent, letterSpacing: '0.1em',
                        textTransform: 'uppercase', marginBottom: 8,
                      }}>
                        {generatedData.phases.length} Phases
                      </div>
                      <div style={{
                        display: 'flex', flexDirection: 'column',
                        gap: 8,
                      }}>
                        {generatedData.phases.map((phase, i) => (
                          <div key={i} style={{
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.07)',
                            borderRadius: 8,
                            padding: '12px 16px',
                          }}>
                            <div style={{
                              display: 'flex',
                              alignItems: 'center', gap: 8,
                              marginBottom: 6,
                            }}>
                              <span style={{
                                fontSize: 10, fontWeight: 700,
                                color: hexToRgba(accent, 0.6),
                                fontFamily: 'monospace',
                              }}>
                                {String(i + 1).padStart(2, '0')}
                              </span>
                              <span style={{
                                fontSize: 13, fontWeight: 700,
                                color: '#fff',
                              }}>
                                {phase.name}
                              </span>
                              {phase.features && (
                                <span style={{
                                  marginLeft: 'auto',
                                  fontSize: 9, fontWeight: 700,
                                  color: accent,
                                  background: hexToRgba(accent, 0.08),
                                  padding: '2px 7px',
                                  borderRadius: 999,
                                  letterSpacing: '0.06em',
                                }}>
                                  {phase.features.length} features
                                </span>
                              )}
                            </div>
                            {phase.description && (
                              <div style={{
                                fontSize: 12,
                                color: 'rgba(255,255,255,0.4)',
                                lineHeight: 1.5,
                              }}>
                                {phase.description}
                              </div>
                            )}
                            {phase.features && 
                             phase.features.length > 0 && (
                              <div style={{
                                marginTop: 8,
                                display: 'flex', gap: 4,
                                flexWrap: 'wrap',
                              }}>
                                {phase.features.map((f, j) => (
                                  <span key={j} style={{
                                    fontSize: 10,
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    borderRadius: 4,
                                    padding: '2px 7px',
                                    color: 'rgba(255,255,255,0.5)',
                                  }}>
                                    {f.name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
  
                  {/* Success state */}
                  <div style={{
                    background: hexToRgba(accent, 0.05),
                    border: `1px solid ${hexToRgba(accent, 0.2)}`,
                    borderRadius: 10,
                    padding: '16px 20px',
                    display: 'flex',
                    alignItems: 'center', gap: 12,
                  }}>
                    <Sparkles size={18} color={accent} />
                    <div>
                      <div style={{
                        fontSize: 13, fontWeight: 700,
                        color: '#fff', marginBottom: 2,
                      }}>
                        Blueprint generated
                      </div>
                      <div style={{
                        fontSize: 11,
                        color: 'rgba(255,255,255,0.4)',
                      }}>
                        Check the Prompts and Files 
                        tabs above, or export as ZIP
                      </div>
                    </div>
                    <Link
                      href={`/dashboard/projects/${projectId}`}
                      style={{
                        marginLeft: 'auto',
                        display: 'inline-flex',
                        alignItems: 'center', gap: 6,
                        background: accent, color: '#000',
                        textDecoration: 'none',
                        borderRadius: 8,
                        padding: '8px 16px',
                        fontSize: 11, fontWeight: 800,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                      }}
                    >
                      View Overview →
                    </Link>
                  </div>
                </>
              )}
            </div>
          )}
  
          {/* ── PROMPTS TAB ── */}
          {rightTab === 'prompts' && (
            <div>
              {!generatedData ? (
                <div style={{
                  textAlign: 'center', padding: '60px 0',
                  color: 'rgba(255,255,255,0.2)', fontSize: 13,
                }}>
                  Generate a blueprint first to see prompts
                </div>
              ) : (
                <div style={{
                  display: 'flex', flexDirection: 'column',
                  gap: 12,
                }}>
                  <div style={{
                    fontSize: 10, fontWeight: 700,
                    color: 'rgba(255,255,255,0.3)',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    marginBottom: 4,
                  }}>
                    Development prompts by phase
                  </div>
                  {generatedData.phases?.map((phase, i) => (
                    <div key={i}>
                      <div style={{
                        fontSize: 11, fontWeight: 700,
                        color: accent, letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        marginBottom: 8, marginTop: i > 0 ? 8 : 0,
                      }}>
                        Phase {i + 1}: {phase.name}
                      </div>
                      {phase.features?.map((f, j) => (
                        <div key={j} style={{
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.07)',
                          borderRadius: 8, padding: '12px 14px',
                          marginBottom: 6,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 10,
                        }}>
                          <div>
                            <div style={{
                              fontSize: 12, fontWeight: 600,
                              color: '#fff', marginBottom: 2,
                            }}>
                              {f.name}
                            </div>
                            <div style={{
                              fontSize: 10,
                              color: 'rgba(255,255,255,0.3)',
                              textTransform: 'uppercase',
                              letterSpacing: '0.06em',
                            }}>
                              {f.type || 'FEATURE_BUILD'}
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              const prompt = 
                                `Build feature: ${f.name}\n\n` +
                                `${f.description}\n\n` +
                                `Phase: ${phase.name}\n` +
                                `Project: ${project?.name}`
                              navigator.clipboard
                                .writeText(prompt)
                                .then(() => 
                                  toast.success('Copied'))
                            }}
                            style={{
                              flexShrink: 0,
                              background: 'transparent',
                              border: '1px solid rgba(255,255,255,0.1)',
                              borderRadius: 6, padding: '5px 10px',
                              fontSize: 10, fontWeight: 700,
                              color: 'rgba(255,255,255,0.4)',
                              cursor: 'pointer',
                              letterSpacing: '0.06em',
                              textTransform: 'uppercase',
                              transition: 'all 0.15s',
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.borderColor 
                                = accent
                              e.currentTarget.style.color 
                                = accent
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.borderColor 
                                = 'rgba(255,255,255,0.1)'
                              e.currentTarget.style.color 
                                = 'rgba(255,255,255,0.4)'
                            }}
                          >
                            Copy
                          </button>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
  
          {/* ── FILES TAB ── */}
          {rightTab === 'files' && (
            <div>
              {!generatedData?.markdownFiles ? (
                <div style={{
                  textAlign: 'center', padding: '60px 0',
                  color: 'rgba(255,255,255,0.2)', fontSize: 13,
                }}>
                  Generate a blueprint first to see files
                </div>
              ) : (
                <div style={{
                  display: 'flex', flexDirection: 'column',
                  gap: 6,
                }}>
                  {isConnected ? (
                    <div style={{
                      marginBottom: 12, padding: '8px 12px',
                      background: 'rgba(16,185,129,0.08)',
                      border: '1px solid rgba(16,185,129,0.2)',
                      borderRadius: 8, fontSize: 11,
                      color: '#10b981',
                    }}>
                      ✓ Files synced to local folder
                    </div>
                  ) : (
                    <div style={{
                      marginBottom: 12, padding: '8px 12px',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 8, fontSize: 11,
                      color: 'rgba(255,255,255,0.35)',
                    }}>
                      Connect a folder on the Overview page 
                      to sync files locally
                    </div>
                  )}
                  <div style={{
                    fontSize: 10, fontWeight: 700,
                    color: 'rgba(255,255,255,0.3)',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase', marginBottom: 8,
                  }}>
                    {Object.keys(generatedData.markdownFiles)
                      .length} files generated
                  </div>
                  {Object.keys(generatedData.markdownFiles)
                    .map(filePath => (
                    <div key={filePath} style={{
                      display: 'flex',
                      alignItems: 'center', gap: 10,
                      padding: '9px 12px',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: 8,
                    }}>
                      <span style={{
                        fontSize: 11, fontFamily: 'monospace',
                        color: accent, flexShrink: 0,
                      }}>
                        📄
                      </span>
                      <span style={{
                        fontSize: 12, fontFamily: 'monospace',
                        color: 'rgba(255,255,255,0.7)',
                        flex: 1, overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {filePath}
                      </span>
                      <button
                        onClick={() => {
                          const content = 
                            generatedData.markdownFiles![filePath]
                          navigator.clipboard.writeText(content)
                            .then(() => toast.success('Copied'))
                        }}
                        style={{
                          flexShrink: 0,
                          background: 'transparent',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: 5, padding: '3px 8px',
                          fontSize: 9, fontWeight: 700,
                          color: 'rgba(255,255,255,0.3)',
                          cursor: 'pointer',
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.color = accent
                          e.currentTarget.style.borderColor 
                            = hexToRgba(accent, 0.3)
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.color = 
                            'rgba(255,255,255,0.3)'
                          e.currentTarget.style.borderColor = 
                            'rgba(255,255,255,0.08)'
                        }}
                      >
                        Copy
                      </button>
                    </div>
                  ))}
  
                  <button
                    onClick={handleExportZip}
                    style={{
                      marginTop: 8,
                      width: '100%',
                      background: accent, color: '#000',
                      border: 'none', borderRadius: 8,
                      padding: '11px',
                      fontSize: 11, fontWeight: 800,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                    }}
                  >
                    ↓ Export All as ZIP
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
  
      {/* Animations */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes wBounce {
          0%, 80%, 100% { 
            transform: scale(0.6); opacity: 0.4; 
          }
          40% { transform: scale(1); opacity: 1; }
        }
        @keyframes wPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}} />
    </div>
  )
}
