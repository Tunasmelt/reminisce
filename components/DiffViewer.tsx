'use client'

import { useMemo, useState } from 'react'
import * as Diff from 'diff'
import { useTheme } from '@/hooks/useTheme'

interface DiffViewerProps {
  oldContent: string
  newContent: string
  oldLabel: string
  newLabel: string
}

type ViewMode = 'unified' | 'split' | 'summary'

export default function DiffViewer({ 
  oldContent, newContent, 
  oldLabel, newLabel 
}: DiffViewerProps) {
  const { accent } = useTheme()
  const [mode, setMode] = useState<ViewMode>('unified')
  const [currentHunk, setCurrentHunk] = useState(0)

  // Compute diff
  const diff = useMemo(() => 
    Diff.diffLines(oldContent, newContent),
    [oldContent, newContent]
  )

  // Stats
  const stats = useMemo(() => {
    let added = 0, removed = 0
    diff.forEach(part => {
      const lines = part.value
        .split('\n')
        .filter(l => l.trim()).length
      if (part.added) added += lines
      if (part.removed) removed += lines
    })
    return { added, removed }
  }, [diff])

  // Find hunk positions (changed blocks)
  const hunkIndices = useMemo(() => 
    diff.reduce((acc, part, i) => {
      if (part.added || part.removed) acc.push(i)
      return acc
    }, [] as number[]),
    [diff]
  )

  // ─── Unified mode renderer ───────────
  const renderUnified = () => (
    <div style={{
      fontFamily: 'monospace',
      fontSize: 12,
      lineHeight: 1.7,
    }}>
      {diff.map((part, partIndex) => {
        const lines = part.value
          .split('\n')
          .filter((_, i, arr) => 
            i < arr.length - 1 || arr[i] !== '')
        
        return lines.map((line, lineIndex) => {
          const isAdded = part.added
          const isRemoved = part.removed
          
          return (
            <div
              key={`${partIndex}-${lineIndex}`}
              id={`hunk-${hunkIndices.indexOf(partIndex)}`}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                padding: '1px 0',
                background: isAdded 
                  ? 'rgba(16,185,129,0.08)'
                  : isRemoved
                  ? 'rgba(239,68,68,0.08)'
                  : 'transparent',
                borderLeft: isAdded
                  ? '2px solid rgba(16,185,129,0.5)'
                  : isRemoved
                  ? '2px solid rgba(239,68,68,0.5)'
                  : '2px solid transparent',
              }}
            >
              {/* Gutter */}
              <span style={{
                width: 24,
                textAlign: 'center',
                color: isAdded 
                  ? 'rgba(16,185,129,0.7)'
                  : isRemoved
                  ? 'rgba(239,68,68,0.7)'
                  : 'transparent',
                fontSize: 11,
                userSelect: 'none',
                flexShrink: 0,
                paddingLeft: 4,
              }}>
                {isAdded ? '+' : isRemoved ? '−' : ' '}
              </span>
              
              {/* Line content */}
              <span style={{
                color: isAdded
                  ? 'rgba(110,231,183,1)'
                  : isRemoved
                  ? 'rgba(252,165,165,1)'
                  : 'rgba(255,255,255,0.6)',
                paddingLeft: 8,
                wordBreak: 'break-all',
              }}>
                {line || ' '}
              </span>
            </div>
          )
        })
      })}
    </div>
  )

  // ─── Split mode renderer ──────────────
  const renderSplit = () => {
    const leftLines: { text: string; type: string }[] = []
    const rightLines: { text: string; type: string }[] = []

    diff.forEach(part => {
      const lines = part.value
        .split('\n')
        .filter((_, i, arr) => 
          i < arr.length - 1 || arr[i] !== '')
      
      if (part.added) {
        lines.forEach(l => {
          leftLines.push({ text: '', type: 'empty' })
          rightLines.push({ text: l, type: 'added' })
        })
      } else if (part.removed) {
        lines.forEach(l => {
          leftLines.push({ text: l, type: 'removed' })
          rightLines.push({ text: '', type: 'empty' })
        })
      } else {
        lines.forEach(l => {
          leftLines.push({ text: l, type: 'same' })
          rightLines.push({ text: l, type: 'same' })
        })
      }
    })

    const maxLines = Math.max(
      leftLines.length, rightLines.length
    )

    const lineStyle = (type: string) => ({
      padding: '1px 8px',
      fontFamily: 'monospace' as const,
      fontSize: 12,
      lineHeight: 1.7,
      wordBreak: 'break-all' as const,
      background: type === 'added'
        ? 'rgba(16,185,129,0.08)'
        : type === 'removed'
        ? 'rgba(239,68,68,0.08)'
        : 'transparent',
      color: type === 'added'
        ? 'rgba(110,231,183,1)'
        : type === 'removed'
        ? 'rgba(252,165,165,1)'
        : type === 'empty'
        ? 'transparent'
        : 'rgba(255,255,255,0.6)',
      borderLeft: type === 'added'
        ? '2px solid rgba(16,185,129,0.4)'
        : type === 'removed'
        ? '2px solid rgba(239,68,68,0.4)'
        : '2px solid transparent',
    })

    return (
      <div style={{ display: 'flex', gap: 0 }}>
        {/* Left panel */}
        <div style={{ flex: 1, overflowX: 'auto' }}>
          <div style={{
            padding: '6px 12px',
            fontSize: 10, fontWeight: 700,
            letterSpacing: '0.08em',
            color: 'rgba(252,165,165,0.8)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            textTransform: 'uppercase',
            background: 'rgba(239,68,68,0.05)',
          }}>
            {oldLabel}
          </div>
          {Array.from({ length: maxLines }, (_, i) => (
            <div key={i} 
              style={lineStyle(leftLines[i]?.type || 'empty')}>
              {leftLines[i]?.text || ' '}
            </div>
          ))}
        </div>
        
        {/* Divider */}
        <div style={{ 
          width: 1, 
          background: 'rgba(255,255,255,0.06)',
          flexShrink: 0,
        }} />
        
        {/* Right panel */}
        <div style={{ flex: 1, overflowX: 'auto' }}>
          <div style={{
            padding: '6px 12px',
            fontSize: 10, fontWeight: 700,
            letterSpacing: '0.08em',
            color: 'rgba(110,231,183,0.8)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            textTransform: 'uppercase',
            background: 'rgba(16,185,129,0.05)',
          }}>
            {newLabel}
          </div>
          {Array.from({ length: maxLines }, (_, i) => (
            <div key={i}
              style={lineStyle(rightLines[i]?.type || 'empty')}>
              {rightLines[i]?.text || ' '}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ─── Summary mode (changed sections only) ─
  const renderSummary = () => {
    const sections: {
      header: string
      changes: typeof diff
    }[] = []
    let currentSection = { header: 'General', changes: [] as typeof diff }
    
    diff.forEach(part => {
      const lines = part.value.split('\n')
      lines.forEach(line => {
        if (line.startsWith('[') && 
            line.includes(']')) {
          if (currentSection.changes.some(
            c => c.added || c.removed
          )) {
            sections.push({ ...currentSection })
          }
          currentSection = { 
            header: line, 
            changes: [] 
          }
        }
      })
      if (part.added || part.removed) {
        currentSection.changes.push(part)
      }
    })
    if (currentSection.changes.some(
      c => c.added || c.removed
    )) {
      sections.push(currentSection)
    }

    if (sections.length === 0) {
      return (
        <div style={{ 
          padding: 32, textAlign: 'center',
          color: 'rgba(255,255,255,0.3)',
          fontSize: 13,
        }}>
          No changes detected between these versions.
        </div>
      )
    }

    return (
      <div style={{ 
        display: 'flex', flexDirection: 'column',
        gap: 16,
      }}>
        {sections.map((section, i) => (
          <div key={i} style={{
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8,
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '8px 14px',
              background: 'rgba(255,255,255,0.04)',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              fontSize: 11, fontWeight: 700,
              letterSpacing: '0.06em',
              color: accent,
            }}>
              {section.header}
            </div>
            <div style={{ 
              padding: '8px 0',
              fontFamily: 'monospace',
              fontSize: 12,
            }}>
              {section.changes.map((part, j) => 
                part.value
                  .split('\n')
                  .filter(l => l.trim())
                  .map((line, k) => (
                    <div key={`${j}-${k}`} style={{
                      padding: '1px 14px',
                      color: part.added 
                        ? 'rgba(110,231,183,1)'
                        : 'rgba(252,165,165,1)',
                      background: part.added
                        ? 'rgba(16,185,129,0.06)'
                        : 'rgba(239,68,68,0.06)',
                    }}>
                      {part.added ? '+ ' : '− '}
                      {line}
                    </div>
                  ))
              )}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div>
      {/* Stats bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 16,
        flexWrap: 'wrap',
      }}>
        {/* Change counts */}
        <div style={{
          display: 'flex', gap: 8,
        }}>
          {stats.added > 0 && (
            <span style={{
              padding: '3px 10px',
              borderRadius: 999,
              background: 'rgba(16,185,129,0.1)',
              border: '1px solid rgba(16,185,129,0.25)',
              color: '#10b981',
              fontSize: 11, fontWeight: 700,
            }}>
              +{stats.added} added
            </span>
          )}
          {stats.removed > 0 && (
            <span style={{
              padding: '3px 10px',
              borderRadius: 999,
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.25)',
              color: '#ef4444',
              fontSize: 11, fontWeight: 700,
            }}>
              −{stats.removed} removed
            </span>
          )}
          {stats.added === 0 && stats.removed === 0 && (
            <span style={{
              padding: '3px 10px',
              borderRadius: 999,
              background: 'rgba(255,255,255,0.05)',
              color: 'rgba(255,255,255,0.4)',
              fontSize: 11, fontWeight: 700,
            }}>
              No changes
            </span>
          )}
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Mode switcher */}
        <div style={{
          display: 'flex', gap: 0,
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 8, overflow: 'hidden',
        }}>
          {(['unified', 'split', 'summary'] as ViewMode[])
            .map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                padding: '6px 14px',
                fontSize: 10, fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                border: 'none',
                borderRight: m !== 'summary'
                  ? '1px solid rgba(255,255,255,0.1)'
                  : 'none',
                cursor: 'pointer',
                background: mode === m
                  ? 'rgba(255,255,255,0.08)'
                  : 'transparent',
                color: mode === m
                  ? '#fff'
                  : 'rgba(255,255,255,0.35)',
                transition: 'all 0.15s',
              }}
            >
              {m}
            </button>
          ))}
        </div>

        {/* Hunk navigation */}
        {hunkIndices.length > 0 && mode !== 'summary' && (
          <div style={{ 
            display: 'flex', gap: 4,
            alignItems: 'center',
          }}>
            <button
              onClick={() => {
                const prev = Math.max(0, currentHunk - 1)
                setCurrentHunk(prev)
                document.getElementById(
                  `hunk-${prev}`
                )?.scrollIntoView({ 
                  behavior: 'smooth', 
                  block: 'center' 
                })
              }}
              style={{
                width: 28, height: 28,
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 6,
                background: 'transparent',
                color: 'rgba(255,255,255,0.4)',
                cursor: 'pointer',
                fontSize: 14,
                display: 'flex', 
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ↑
            </button>
            <span style={{
              fontSize: 10,
              color: 'rgba(255,255,255,0.3)',
              fontFamily: 'monospace',
              minWidth: 40,
              textAlign: 'center',
            }}>
              {currentHunk + 1}/{hunkIndices.length}
            </span>
            <button
              onClick={() => {
                const next = Math.min(
                  hunkIndices.length - 1, 
                  currentHunk + 1
                )
                setCurrentHunk(next)
                document.getElementById(
                  `hunk-${next}`
                )?.scrollIntoView({ 
                  behavior: 'smooth', 
                  block: 'center' 
                })
              }}
              style={{
                width: 28, height: 28,
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 6,
                background: 'transparent',
                color: 'rgba(255,255,255,0.4)',
                cursor: 'pointer',
                fontSize: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ↓
            </button>
          </div>
        )}
      </div>

      {/* Diff content */}
      <div style={{
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12,
        overflow: 'hidden',
        maxHeight: 520,
        overflowY: 'auto',
      }}>
        {mode === 'unified' && renderUnified()}
        {mode === 'split' && renderSplit()}
        {mode === 'summary' && (
          <div style={{ padding: 16 }}>
            {renderSummary()}
          </div>
        )}
      </div>
    </div>
  )
}
