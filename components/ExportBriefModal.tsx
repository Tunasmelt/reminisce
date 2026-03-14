'use client'

import { useState, useEffect } from 'react'
import { X, Download, Copy, Check,
         FileText, Code, AlignLeft } 
  from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import { 
  generateMarkdown, generatePlainText,
  generateJSON, downloadFile, 
  copyToClipboard, BriefData 
} from '@/lib/exportBrief'

interface ExportBriefModalProps {
  data: BriefData
  onClose: () => void
}

type Format = 'markdown' | 'text' | 'json'

export default function ExportBriefModal({
  data, onClose
}: ExportBriefModalProps) {
  const { accent } = useTheme()
  const [format, setFormat] = 
    useState<Format>('markdown')
  const [copied, setCopied] = useState(false)
  const [downloaded, setDownloaded] = 
    useState(false)

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => 
      window.removeEventListener('keydown', handler)
  }, [onClose])

  // Generate content for current format
  const content = (() => {
    if (format === 'markdown') 
      return generateMarkdown(data)
    if (format === 'text') 
      return generatePlainText(data)
    return generateJSON(data)
  })()

  const fileExt = {
    markdown: 'md',
    text: 'txt', 
    json: 'json'
  }[format]

  const mimeType = {
    markdown: 'text/markdown',
    text: 'text/plain',
    json: 'application/json'
  }[format]

  const fileName = `${data.project.name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
  }-brief.${fileExt}`

  const handleCopy = async () => {
    const success = await copyToClipboard(content)
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleDownload = () => {
    downloadFile(content, fileName, mimeType)
    setDownloaded(true)
    setTimeout(() => setDownloaded(false), 2000)
  }

  const formats: Array<{
    id: Format
    label: string
    icon: React.ReactNode
    description: string
  }> = [
    {
      id: 'markdown',
      label: 'Markdown',
      icon: <FileText size={14} />,
      description: 'GitHub, Notion, Linear'
    },
    {
      id: 'text',
      label: 'Plain text',
      icon: <AlignLeft size={14} />,
      description: 'Email, Slack, Docs'
    },
    {
      id: 'json',
      label: 'JSON',
      icon: <Code size={14} />,
      description: 'APIs, integrations'
    },
  ]

  return (
    // Backdrop
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(4px)',
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      {/* Modal */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 760,
          maxHeight: '85vh',
          background: '#0a0a0a',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 16,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Modal header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div>
            <div style={{
              fontSize: 16,
              fontWeight: 800,
              color: '#fff',
              marginBottom: 2,
            }}>
              Export Project Brief
            </div>
            <div style={{
              fontSize: 12,
              color: 'rgba(255,255,255,0.35)',
            }}>
              {data.project.name} · {' '}
              {data.phases.length} phases · {' '}
              {data.features.length} features
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32,
              borderRadius: 8,
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.4)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Format selector + actions */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          flexWrap: 'wrap',
          gap: 12,
        }}>
          {/* Format tabs */}
          <div style={{
            display: 'flex',
            gap: 0,
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8,
            overflow: 'hidden',
          }}>
            {formats.map((f, i) => (
              <button
                key={f.id}
                onClick={() => setFormat(f.id)}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderRight: i < formats.length - 1
                    ? '1px solid rgba(255,255,255,0.1)'
                    : 'none',
                  background: format === f.id
                    ? 'rgba(255,255,255,0.07)'
                    : 'transparent',
                  color: format === f.id
                    ? '#fff'
                    : 'rgba(255,255,255,0.35)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  transition: 'all 0.15s',
                }}
              >
                {f.icon}
                {f.label}
                <span style={{
                  fontSize: 10,
                  color: format === f.id
                    ? 'rgba(255,255,255,0.4)'
                    : 'rgba(255,255,255,0.2)',
                }}>
                  {f.description}
                </span>
              </button>
            ))}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleCopy}
              style={{
                padding: '8px 16px',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8,
                background: 'transparent',
                color: copied
                  ? '#10b981'
                  : 'rgba(255,255,255,0.6)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                fontWeight: 600,
                transition: 'all 0.15s',
              }}
            >
              {copied 
                ? <Check size={14} /> 
                : <Copy size={14} />}
              {copied ? 'Copied!' : 'Copy'}
            </button>

            <button
              onClick={handleDownload}
              style={{
                padding: '8px 20px',
                border: 'none',
                borderRadius: 8,
                background: accent,
                color: '#000',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.opacity = '0.88'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.opacity = '1'
              }}
            >
              {downloaded 
                ? <Check size={14} />
                : <Download size={14} />}
              {downloaded 
                ? 'Downloaded!' 
                : `Download .${fileExt}`}
            </button>
          </div>
        </div>

        {/* Preview area */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '20px 24px',
        }}>
          {/* Line count badge */}
          <div style={{
            fontSize: 10,
            color: 'rgba(255,255,255,0.25)',
            marginBottom: 12,
            fontFamily: 'monospace',
            letterSpacing: '0.05em',
          }}>
            {content.split('\n').length} lines · {' '}
            {(content.length / 1024).toFixed(1)} KB · {' '}
            {fileName}
          </div>

          {/* Content preview */}
          <pre style={{
            fontFamily: 'monospace',
            fontSize: 12,
            lineHeight: 1.8,
            color: 'rgba(255,255,255,0.7)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            margin: 0,
          }}>
            {content.split('\n').map((line, i) => {
              // Syntax highlight for markdown preview
              if (format === 'markdown') {
                if (line.startsWith('# ')) return (
                  <span key={i}>
                    <span style={{ 
                      color: '#fff', 
                      fontWeight: 700,
                      fontSize: 14,
                    }}>
                      {line}
                    </span>{'\n'}
                  </span>
                )
                if (line.startsWith('## ')) return (
                  <span key={i}>
                    <span style={{ 
                      color: '#fff',
                      fontWeight: 700,
                    }}>
                      {line}
                    </span>{'\n'}
                  </span>
                )
                if (line.startsWith('### ')) return (
                  <span key={i}>
                    <span style={{ color: accent }}>
                      {line}
                    </span>{'\n'}
                  </span>
                )
                if (line.startsWith('> ')) return (
                  <span key={i}>
                    <span style={{ 
                      color: 'rgba(255,255,255,0.3)',
                      fontStyle: 'italic',
                    }}>
                      {line}
                    </span>{'\n'}
                  </span>
                )
                if (line.startsWith('**')) return (
                  <span key={i}>
                    <span style={{ color: accent }}>
                      {line}
                    </span>{'\n'}
                  </span>
                )
                if (line.startsWith('- ')) return (
                  <span key={i}>
                    <span style={{ 
                      color: 'rgba(255,255,255,0.6)',
                    }}>
                      {line}
                    </span>{'\n'}
                  </span>
                )
                if (line === '---') return (
                  <span key={i}>
                    <span style={{ 
                      color: 'rgba(255,255,255,0.15)',
                    }}>
                      {line}
                    </span>{'\n'}
                  </span>
                )
              }
              // JSON highlight
              if (format === 'json') {
                if (line.trim().startsWith('"') && 
                    line.includes('":')) return (
                  <span key={i}>
                    <span style={{ color: accent }}>
                      {line}
                    </span>{'\n'}
                  </span>
                )
              }
              return (
                <span key={i}>{line}{'\n'}</span>
              )
            })}
          </pre>
        </div>
      </div>
    </div>
  )
}
