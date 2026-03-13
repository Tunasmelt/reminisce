'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/hooks/useTheme'

interface Version {
  id: string
  content: string
  changed_at: string
}

function hexToRgba(hex: string, a: number) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

export default function ContextPage() {
  const params = useParams()
  const { accent } = useTheme()
  const projectId = params.id as string

  const [project, setProject] = useState<{name: string} | null>(null)
  const [history, setHistory] = useState<Version[]>([])
  const [loading, setLoading] = useState(true)
  const [activeContent, setActiveContent] = useState('')

  useEffect(() => {
    const fetchProj = async () => {
      const [{ data: proj }, { data: hist }] = await Promise.all([
        supabase.from('projects').select('name').eq('id', projectId).single(),
        supabase.from('context_history').select('*').eq('project_id', projectId).order('changed_at', { ascending: false })
      ])
      if (proj) setProject(proj)
      if (hist) {
        setHistory(hist as Version[])
        if (hist.length > 0) setActiveContent(hist[0].content)
      }
      setLoading(false)
    }
    fetchProj()
  }, [projectId])

  const handleExportJSON = () => {
    const blob = new Blob([activeContent], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `context-${projectId}.json`
    a.click()
    toast.success('JSON export complete')
  }

  const handleExportMD = () => {
    const blob = new Blob([activeContent], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `context-${projectId}.md`
    a.click()
    toast.success('Markdown export complete')
  }

  const formatContent = (text: string) => {
    const lines = text.split('\n')
    return lines.map((line, i) => {
      let color = 'rgba(255,255,255,0.8)'
      let fontWeight = '400'
      
      if (line.trim().startsWith('//')) {
        color = 'rgba(255,255,255,0.3)'
      } else if (line.trim().startsWith('[')) {
        color = accent
        fontWeight = '700'
      }

      return (
        <div key={i} style={{ color, fontWeight, minHeight: 18 }}>
          {line}
        </div>
      )
    })
  }

  if (loading) return <div style={{ padding: 48, background: '#000', minHeight: '100vh' }}>Loading Architecture...</div>

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '48px 32px', background: '#000' }}>
      <title>{`Reminisce — Context Engine — ${project?.name}`}</title>

      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 48 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#fff', margin: 0, textTransform: 'uppercase', letterSpacing: '-0.02em' }}>
            Context Engine
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <div style={{ 
              background: hexToRgba(accent, 0.1), 
              border: `1px solid ${hexToRgba(accent, 0.2)}`, 
              color: accent, 
              fontSize: 10, 
              fontWeight: 800, 
              padding: '2px 8px', 
              borderRadius: 4,
              textTransform: 'uppercase'
            }}>
              V{history.length}.0.0
            </div>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              STABLE_BUILD_ACTIVE
            </span>
          </div>
        </div>
      </div>

      {/* CONTEXT DOCUMENT DISPLAY */}
      <div style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12,
        padding: 32,
        fontFamily: 'monospace',
        fontSize: 13,
        lineHeight: 1.8,
        color: 'rgba(255,255,255,0.8)',
        maxHeight: 500,
        overflowY: 'auto',
        marginBottom: 48,
        scrollbarWidth: 'none'
      }}>
        {formatContent(activeContent || '// No context data available for this sector.')}
      </div>

      {/* VERSION HISTORY */}
      <div style={{ marginBottom: 48 }}>
        <h3 style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 24 }}>
          VERSION_HISTORY_TIMELINE
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {history.map((v, i) => (
            <div key={v.id} style={{ display: 'flex', gap: 24, cursor: 'pointer' }} onClick={() => setActiveContent(v.content)}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 12 }}>
                <div style={{ 
                  width: 8, 
                  height: 8, 
                  borderRadius: '50%', 
                  background: activeContent === v.content ? accent : 'rgba(255,255,255,0.1)',
                  marginTop: 6,
                  transition: 'background 0.2s'
                }} />
                {i < history.length - 1 && (
                  <div style={{ width: 1, flex: 1, background: 'rgba(255,255,255,0.08)', minHeight: 24 }} />
                )}
              </div>
              <div style={{ paddingBottom: 24, flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: activeContent === v.content ? accent : 'rgba(255,255,255,0.5)', transition: 'color 0.2s' }}>
                    0x{v.id.slice(0, 8).toUpperCase()}
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>
                    {new Date(v.changed_at).toLocaleString()}
                  </div>
                </div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>
                  System state snapshot synchronized to sector registry.
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* EXPORT ROW */}
      <div style={{ display: 'flex', gap: 12 }}>
        <button 
          onClick={handleExportJSON}
          style={{
            background: 'transparent',
            border: `1px solid ${accent}`,
            color: accent,
            borderRadius: 999,
            padding: '10px 24px',
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = hexToRgba(accent, 0.05)}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          EXPORT JSON
        </button>
        <button 
          onClick={handleExportMD}
          style={{
            background: 'transparent',
            border: `1px solid ${accent}`,
            color: accent,
            borderRadius: 999,
            padding: '10px 24px',
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = hexToRgba(accent, 0.05)}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          EXPORT MARKDOWN
        </button>
      </div>
    </div>
  )
}
