'use client'

import { useState, useEffect, Suspense } from 'react'
import { useParams } from 'next/navigation'
import { 
  Radio
} from 'lucide-react'
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
    <div style={{ display: 'flex', height: 'calc(100vh - 104px)', background: '#000' }}>
      <title>{`Reminisce — API Lab — ${project?.name}`}</title>

      {/* LEFT PANEL: REQUEST EDITOR */}
      <div style={{ 
        width: 480, 
        borderRight: '1px solid rgba(255,255,255,0.06)', 
        padding: 32, 
        display: 'flex', 
        flexDirection: 'column',
        gap: 24,
        background: 'rgba(255,255,255,0.01)'
      }}>
        <h2 style={{ fontSize: 13, fontWeight: 800, color: '#fff', letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0 }}>
          REQUEST_CONSTRUCTOR
        </h2>

        {/* Method & URL */}
        <div style={{ display: 'flex', gap: 12 }}>
          <select 
            value={method} 
            onChange={(e) => setMethod(e.target.value)}
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
              padding: '0 16px',
              fontSize: 11,
              fontWeight: 800,
              color: accent,
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <input 
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://api.domain.io/v1/..."
            style={{
              flex: 1,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
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
          <div style={{ display: 'flex', gap: 24, borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: 20 }}>
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
                  fontSize: 10,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
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
                      style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '8px 12px', fontSize: 11, color: '#fff', fontFamily: 'monospace' }}
                    />
                    <input 
                      placeholder="VALUE" 
                      value={h.value} 
                      onChange={(e) => updateHeader(i, h.key, e.target.value)}
                      style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '8px 12px', fontSize: 11, color: '#fff', fontFamily: 'monospace' }}
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
                style={{ width: '100%', height: 160, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: 16, fontSize: 12, color: accent, fontFamily: 'monospace', outline: 'none', resize: 'none' }}
              />
            )}
            {activeTab === 'Auth' && (
               <select 
                value={authType} 
                onChange={(e) => setAuthType(e.target.value)}
                style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: 12, fontSize: 12, color: '#fff', outline: 'none' }}
               >
                 <option>None</option>
                 <option>Bearer Token</option>
               </select>
            )}
          </div>
        </div>

        <button 
          onClick={handleSend}
          disabled={isExecuting}
          style={{
            background: accent,
            color: '#000',
            border: 'none',
            borderRadius: 999,
            padding: '14px',
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            cursor: 'pointer'
          }}
        >
          {isExecuting ? 'TRANSMITTING...' : 'EXECUTE_REQUEST →'}
        </button>
      </div>

      {/* RIGHT PANEL: RESPONSE VIEWER */}
      <div style={{ flex: 1, padding: 32, display: 'flex', flexDirection: 'column', gap: 24, background: '#000' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 13, fontWeight: 800, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0 }}>
            SIGNAL_RESPONSE
          </h2>
          <button style={{ 
            background: 'transparent', 
            border: `1px solid ${accent}`, 
            color: accent, 
            borderRadius: 999, 
            padding: '6px 20px', 
            fontSize: 10, 
            fontWeight: 800, 
            cursor: 'pointer' 
          }}>
            PREDICTIVE_DESIGN →
          </button>
        </div>

        {response ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Status Line */}
            <div style={{ display: 'flex', gap: 32, padding: '16px 24px', background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
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
              borderRadius: 12,
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
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.15 }}>
            <Radio size={80} style={{ marginBottom: 24 }} />
            <p style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.2em' }}>
              Awaiting transmission signal...
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ApiLabPage() {
  return <Suspense fallback={<div style={{ flex: 1, background: '#000' }} />}><ApiLabContent /></Suspense>
}
