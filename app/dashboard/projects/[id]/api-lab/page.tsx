'use client'

import { useState, useEffect, Suspense } from 'react'
import { useParams } from 'next/navigation'
import { } from 'lucide-react'
import CustomSelect from '@/components/CustomSelect'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/hooks/useTheme'

interface ApiRes {
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
  timing: { total: number; ttfb: number }
  size: number
  error?: string
}



function hexToRgba(hex: string, a: number) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

function ApiLabContent() {
  const params = useParams()
  const { accent } = useTheme()
  const projectId = params.id as string

  const [project, setProject] = useState<{name: string} | null>(null)
  const [loading, setLoading] = useState(true)
  const [method, setMethod] = useState('GET')
  const [url, setUrl] = useState('')
  const [headers, setHeaders] = useState([{ key: '', value: '' }])
  const [body, setBody] = useState('')
  const [authType, setAuthType] = useState('None')
  const [authValue] = useState('')
  const [activeTab, setActiveTab] = useState('Headers')
  
  const [response, setResponse] = useState<ApiRes | null>(null)
  const [isExecuting, setIsExecuting] = useState(false)

  const METHOD_OPTIONS = [
    { value: 'GET',    label: 'GET',    color: '#10b981' },
    { value: 'POST',   label: 'POST',   color: '#3b82f6' },
    { value: 'PUT',    label: 'PUT',    color: '#f59e0b' },
    { value: 'DELETE', label: 'DELETE', color: '#ef4444' },
    { value: 'PATCH',  label: 'PATCH',  color: '#8b5cf6' },
  ]

  useEffect(() => {
    const fetchProject = async () => {
      const { data } = await supabase.from('projects').select('name').eq('id', projectId).single()
      if (data) setProject(data)
      setLoading(false)
    }
    fetchProject()
  }, [projectId])

  const handleSend = async () => {
    if (!url) return toast.error('URL required')
    setIsExecuting(true); setResponse(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const headerObj = headers.reduce((acc, curr) => { if (curr.key) acc[curr.key] = curr.value; return acc }, {} as Record<string, string>)
      const res = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ url, method, headers: headerObj, body, authType, authValue })
      })
      const data = await res.json()
      setResponse(data)
      if (data.error) toast.error(data.error)
    } catch { toast.error('Signal transmission failure') }
    finally { setIsExecuting(false) }
  }

  const updateHeader = (index: number, key: string, value: string) => {
    const next = [...headers]; next[index] = { key, value }; setHeaders(next)
  }

  if (loading) return <div style={{ padding: 48, background: '#000', color: '#fff' }}>Powering up Lab...</div>

  return (
    <div style={{
      display: 'flex',
      height: 'calc(100vh - 68px)',
      background: 'linear-gradient(160deg, rgba(var(--accent-rgb),0.04) 0%, transparent 50%), #07070f',
    }}>
      <title>{`Reminisce — API Lab — ${project?.name}`}</title>

      {/* LEFT PANEL: REQUEST EDITOR */}
      <div style={{ 
        width: 480, 
        flexShrink: 0,
        borderRight: '1px solid rgba(255,255,255,0.08)',
        padding: 28,
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        background: 'rgba(255,255,255,0.025)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        overflowY: 'auto',
      }}>
        <h2 style={{
          fontSize: 10, fontWeight: 800,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.4)',
          margin: 0
        }}>
          Request
        </h2>

        {/* Method & URL */}
        <div style={{ display: 'flex', gap: 12 }}>
          <CustomSelect
            value={method}
            onChange={setMethod}
            options={METHOD_OPTIONS}
            width={110}
            compact
          />
          <input 
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://api.domain.io/v1/..."
            style={{
              flex: 1,
              background: 'rgba(255,255,255,0.05)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 10,
              padding: '12px 16px',
              fontSize: 12,
              color: '#fff',
              fontFamily: 'monospace',
              outline: 'none'
            }}
          />
        </div>

        {/* Tabs */}
        <div>
          <div style={{
            display: 'flex', gap: 20,
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            marginBottom: 20,
            background: 'rgba(255,255,255,0.02)',
            borderRadius: '8px 8px 0 0',
            padding: '0 4px',
          }}>
            {['Headers', 'Body', 'Auth'].map(tab => (
              <button 
                key={tab} 
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '12px 0',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: `2px solid ${activeTab === tab ? accent : 'transparent'}`,
                  color: activeTab === tab ? '#fff' : 'rgba(255,255,255,0.3)',
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: 'none',
                  letterSpacing: 'normal',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          <div style={{ minHeight: 200 }}>
            {activeTab === 'Headers' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {headers.map((h, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8 }}>
                    <input 
                      placeholder="KEY" 
                      value={h.key} 
                      onChange={(e) => updateHeader(i, e.target.value, h.value)}
                      style={{ flex: 1, background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 8, padding: '8px 12px', fontSize: 11, color: '#fff', fontFamily: 'monospace', outline: 'none' }}
                    />
                    <input 
                      placeholder="VALUE" 
                      value={h.value} 
                      onChange={(e) => updateHeader(i, h.key, e.target.value)}
                      style={{ flex: 1, background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 8, padding: '8px 12px', fontSize: 11, color: '#fff', fontFamily: 'monospace', outline: 'none' }}
                    />
                  </div>
                ))}
                <button 
                  onClick={() => setHeaders([...headers, { key: '', value: '' }])}
                  style={{ background: 'transparent', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 6, padding: 8, color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: 700, cursor: 'pointer', marginTop: 8 }}
                >
                  + ADD_ENTRY
                </button>
              </div>
            )}
            {activeTab === 'Body' && (
              <textarea 
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder='{ "key": "value" }'
                style={{
                  width: '100%', height: 160,
                  background: 'rgba(4,4,16,0.8)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255,255,255,0.09)',
                  borderRadius: 10, padding: 16,
                  fontSize: 12, color: accent,
                  fontFamily: 'ui-monospace, monospace',
                  outline: 'none', resize: 'none',
                }}
              />
            )}
            {activeTab === 'Auth' && (
              <CustomSelect
                value={authType}
                onChange={setAuthType}
                options={[
                  { value: 'None', label: 'None' },
                  { value: 'Bearer Token', label: 'Bearer Token' },
                ]}
                width="100%"
              />
            )}
          </div>
        </div>

          <button 
            onClick={handleSend}
            disabled={isExecuting}
            style={{
              background: accent,
              border: 'none',
              borderRadius: 999,
              padding: '14px',
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 'normal',
              textTransform: 'none',
              boxShadow: `0 0 20px ${hexToRgba(accent, 0.3)}`,
              transition: 'all 0.15s',
              cursor: 'pointer'
            }}
          >
          {isExecuting ? 'Sending...' : 'Send request'}
        </button>
      </div>

      {/* RIGHT PANEL: RESPONSE VIEWER */}
      <div style={{ flex: 1, padding: 28, display: 'flex', flexDirection: 'column', gap: 20, background: 'transparent', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{
            fontSize: 10, fontWeight: 800,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.35)',
            margin: 0,
          }}>
            Response
          </h2>
          <button style={{ 
            background: hexToRgba(accent, 0.08),
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            border: `1px solid ${hexToRgba(accent, 0.3)}`,
            color: accent,
            borderRadius: 999,
            padding: '7px 20px',
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}>
            AI suggest
          </button>
        </div>

        {!response ? (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            padding: '24px',
            gap: 16,
          }}>
            
            {/* Helpful header */}
            <div style={{
              fontSize: 11, fontWeight: 500,
              letterSpacing: 'normal',
              textTransform: 'none',
              color: 'rgba(255,255,255,0.45)',
              marginBottom: 4,
            }}>
              Example requests
            </div>
        
            {/* 3 starter request cards */}
            {[
              {
                method: 'GET',
                url: 'https://jsonplaceholder.typicode.com/posts/1',
                label: 'Test endpoint',
                description: 'Fetch a sample JSON response to verify your setup',
                methodColor: '#10b981',
              },
              {
                method: 'POST',
                url: 'https://jsonplaceholder.typicode.com/posts',
                label: 'POST with JSON body',
                description: 'Send structured data and inspect the response',
                methodColor: '#3b82f6',
              },
              {
                method: 'GET',
                url: 'https://api.github.com/repos/vercel/next.js',
                label: 'GitHub API',
                description: 'Public API call — no auth required',
                methodColor: '#10b981',
              },
            ].map((example, i) => (
              <div
                key={i}
                onClick={() => {
                  setUrl(example.url)
                  setMethod(example.method)
                }}
                style={{
                  padding: '14px 16px',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.03)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  transition: 'all 0.15s',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor =
                    hexToRgba(accent, 0.3)
                  e.currentTarget.style.background =
                    hexToRgba(accent, 0.04)
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor =
                    'rgba(255,255,255,0.07)'
                  e.currentTarget.style.background =
                    'rgba(255,255,255,0.02)'
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8, marginBottom: 6,
                }}>
                  <span style={{
                    fontSize: 9, fontWeight: 800,
                    letterSpacing: '0.08em',
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: `${example.methodColor}20`,
                    color: example.methodColor,
                    border: `1px solid ${example.methodColor}40`,
                    flexShrink: 0,
                  }}>
                    {example.method}
                  </span>
                  <span style={{
                    fontSize: 11, fontWeight: 600,
                    color: '#fff',
                  }}>
                    {example.label}
                  </span>
                  <span style={{
                    marginLeft: 'auto',
                    fontSize: 9,
                    color: 'rgba(255,255,255,0.2)',
                  }}>
                    Click to load →
                  </span>
                </div>
                <div style={{
                  fontSize: 10,
                  fontFamily: 'monospace',
                  color: accent,
                  marginBottom: 4,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {example.url}
                </div>
                <div style={{
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.3)',
                  lineHeight: 1.4,
                }}>
                  {example.description}
                </div>
              </div>
            ))}
        
            {/* Divider */}
            <div style={{
              height: 1,
              background: 'rgba(255,255,255,0.05)',
              margin: '4px 0',
            }} />
        
            {/* Hint text */}
            <div style={{
              fontSize: 11,
              color: 'rgba(255,255,255,0.2)',
              textAlign: 'center',
              lineHeight: 1.6,
            }}>
              Enter any URL in the request constructor
              and press Execute to see the response here.
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Status Line */}
            <div style={{ display: 'flex', gap: 32, padding: '16px 24px', background: 'rgba(255,255,255,0.03)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.06)' }}>
              <div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: 4 }}>Status</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: response.status < 300 ? '#10b981' : '#ef4444' }}>{response.status} {response.statusText}</div>
              </div>
              <div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: 4 }}>Size</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{response.size}B</div>
              </div>
              <div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: 4 }}>Time</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{response.timing.total}ms</div>
              </div>
            </div>

            {/* Body Viewer */}
            <div style={{
              flex: 1,
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 16,
              padding: 24,
              fontFamily: 'monospace',
              fontSize: 12,
              lineHeight: 1.6,
              color: 'rgba(255,255,255,0.8)',
              overflowY: 'auto',
              scrollbarWidth: 'none'
            }}>
              <pre>{(() => { try { return JSON.stringify(JSON.parse(response.body), null, 2) } catch { return response.body } })()}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ApiLabPage() {
  return <Suspense fallback={<div style={{ flex: 1, background: '#000' }} />}><ApiLabContent /></Suspense>
}
