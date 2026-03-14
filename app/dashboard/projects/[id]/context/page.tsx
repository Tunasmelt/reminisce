'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/hooks/useTheme'
import DiffViewer from '@/components/DiffViewer'
import CustomSelect from '@/components/CustomSelect'
import { 
  generateMarkdown, generateJSON, 
  downloadFile
} from '@/lib/exportBrief'

interface Version {
  id: string
  content: string
  created_at: string
  sha: string
  label?: string
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
  const [isEditing, setIsEditing] = useState(false)
  const [editableContent, setEditableContent] = useState('')

  // Diff state
  const [diffMode, setDiffMode] = useState(false)
  const [compareFrom, setCompareFrom] = useState<string>('')
  const [compareTo, setCompareTo] = useState<string>('')

  const fetchProj = useCallback(async () => {
    const [{ data: proj }, { data: hist }] = await Promise.all([
      supabase.from('projects').select('name').eq('id', projectId).single(),
      supabase.from('context_versions').select('*').eq('project_id', projectId).order('created_at', { ascending: false })
    ])
    if (proj) setProject(proj)
    if (hist) {
      const versions = hist as Version[]
      setHistory(versions)
      if (versions.length > 0) {
        setActiveContent(versions[0].content)
        setEditableContent(versions[0].content)
      }
    }
    setLoading(false)
  }, [projectId])

  const versionOptions = history.map(v => ({
    value: v.id,
    label: `${v.sha || v.id.slice(0,7)} — ${
      new Date(v.created_at).toLocaleDateString()
    }`,
  }))

  useEffect(() => {
    fetchProj()
  }, [fetchProj])

  const handleSaveContext = async () => {
    try {
      // Save a version snapshot
      const { error } = await supabase
        .from('context_versions')
        .insert({
          project_id: projectId,
          content: editableContent,
        })
      
      if (error) throw error
      
      toast.success('Context state synchronized')
      setIsEditing(false)
      setActiveContent(editableContent)
      fetchProj()
    } catch (err) {
      toast.error('Synchronization failure')
      console.error(err)
    }
  }


  if (loading) return <div style={{ padding: 48, background: '#000', minHeight: '100vh', color: '#fff' }} className="page-enter">Loading Architecture...</div>

  return (
    <div style={{
      display: 'flex',
      height: 'calc(100vh - 104px)',
      background: '#000',
      overflow: 'hidden',
    }}>
  
      {/* ══════════════════════════════
          LEFT — Document Editor (60%)
      ══════════════════════════════ */}
      <div style={{
        flex: 3,
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        minWidth: 0,
      }}>
  
        {/* Editor header */}
        <div style={{
          height: 52,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          flexShrink: 0,
          gap: 12,
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center', gap: 10,
          }}>
            <span style={{
              fontSize: 11, fontWeight: 500,
              letterSpacing: '0.03em',
              textTransform: 'none',
              color: 'rgba(255,255,255,0.35)',
            }}>
              Context
            </span>
            {history.length > 0 && (
              <span style={{
                fontSize: 10, fontFamily: 'monospace',
                color: accent,
                background: hexToRgba(accent, 0.1),
                border: `1px solid ${hexToRgba(accent, 0.2)}`,
                padding: '2px 8px',
                borderRadius: 999,
                fontWeight: 700,
              }}>
                v{history.length}
              </span>
            )}
            {/* Unsaved indicator */}
            {isEditing && editableContent !== activeContent && (
              <span style={{
                width: 6, height: 6,
                borderRadius: '50%',
                background: '#f59e0b',
                display: 'inline-block',
              }} title="Unsaved changes" />
            )}
          </div>
  
          <div style={{
            display: 'flex', gap: 8,
            alignItems: 'center',
          }}>
            {/* Edit/View toggle */}
            <div style={{
              display: 'flex', gap: 0,
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, overflow: 'hidden',
            }}>
              {(['view', 'edit'] as const).map(mode => {
                const isActive = (mode === 'edit') === isEditing
                return (
                  <button
                    key={mode}
                    onClick={() => {
                      if (mode === 'edit') {
                        setDiffMode(false)
                        setIsEditing(true)
                        setEditableContent(activeContent)
                      } else {
                        setIsEditing(false)
                      }
                    }}
                    style={{
                      padding: '5px 14px',
                      fontSize: 10, fontWeight: 700,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      border: 'none',
                      borderRight: mode === 'view'
                        ? '1px solid rgba(255,255,255,0.1)'
                        : 'none',
                      background: isActive
                        ? 'rgba(255,255,255,0.08)'
                        : 'transparent',
                      color: isActive
                        ? '#fff'
                        : 'rgba(255,255,255,0.35)',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {mode}
                  </button>
                )
              })}
            </div>
  
            {/* Save button — only in edit mode */}
            {isEditing && (
              <button
                onClick={handleSaveContext}
                style={{
                  background: accent,
                  color: '#000',
                  border: 'none',
                  borderRadius: 8,
                  padding: '6px 16px',
                  fontSize: 10, fontWeight: 800,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  transition: 'opacity 0.15s',
                }}
                onMouseEnter={e =>
                  e.currentTarget.style.opacity = '0.85'
                }
                onMouseLeave={e =>
                  e.currentTarget.style.opacity = '1'
                }
              >
                Save
              </button>
            )}
          </div>
        </div>
  
        {/* Diff viewer (shown when diffMode) */}
        {diffMode && compareFrom && compareTo
         && compareFrom !== compareTo && (() => {
          const fromV = history.find(
            v => v.id === compareFrom
          )
          const toV = history.find(
            v => v.id === compareTo
          )
          if (!fromV || !toV) return null
          return (
            <div style={{
              flex: 1, overflow: 'auto', padding: 24,
            }}>
              <DiffViewer
                oldContent={fromV.content}
                newContent={toV.content}
                oldLabel={`${fromV.sha || fromV.id.slice(0, 7)} (older)`}
                newLabel={`${toV.sha || toV.id.slice(0, 7)} (newer)`}
              />
            </div>
          )
        })()}
  
        {/* Document display/editor */}
        {!diffMode && (
          <div style={{
            flex: 1, overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
          }}>
            {loading ? (
              <div style={{
                flex: 1, display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'rgba(255,255,255,0.2)',
                fontSize: 13,
              }}>
                Loading context...
              </div>
            ) : isEditing ? (
              /* Edit mode — textarea */
              <textarea
                value={editableContent}
                onChange={e =>
                  setEditableContent(e.target.value)
                }
                onKeyDown={e => {
                  if ((e.ctrlKey || e.metaKey) 
                      && e.key === 's') {
                    e.preventDefault()
                    handleSaveContext()
                  }
                }}
                style={{
                  flex: 1,
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  resize: 'none',
                  padding: '24px 32px',
                  fontFamily: 'monospace',
                  fontSize: 13,
                  color: 'rgba(255,255,255,0.85)',
                  lineHeight: 1.75,
                }}
                placeholder="Start writing your context document..."
                spellCheck={false}
              />
            ) : (
              /* View mode — syntax-colored display */
              <div style={{
                flex: 1, overflow: 'auto',
                padding: '24px 32px',
                fontFamily: 'monospace',
                fontSize: 13,
                lineHeight: 1.75,
              }}>
                {activeContent ? (
                  activeContent.split('\n').map((line, i) => {
                    let color = 'rgba(255,255,255,0.75)'
                    if (line.startsWith('//') 
                        || line.startsWith('#')) {
                      color = 'rgba(255,255,255,0.3)'
                    } else if (line.startsWith('[') 
                               && line.includes(']')) {
                      color = accent
                    } else if (line.startsWith('→')
                               || line.startsWith('->')) {
                      color = 'rgba(255,255,255,0.55)'
                    }
                    return (
                      <div key={i} style={{ color }}>
                        {line || '\u00A0'}
                      </div>
                    )
                  })
                ) : (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '60%',
                    gap: 12,
                    opacity: 0.3,
                  }}>
                    <div style={{ fontSize: 32 }}>📄</div>
                    <div style={{
                      fontSize: 13, fontWeight: 700,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: 'rgba(255,255,255,0.6)',
                    }}>
                      No context yet
                    </div>
                    <div style={{
                      fontSize: 12,
                      color: 'rgba(255,255,255,0.3)',
                      textAlign: 'center',
                    }}>
                      Run the Wizard to generate your 
                      project context document
                    </div>
                  </div>
                )}
              </div>
            )}
  
            {/* Character count footer */}
            {isEditing && (
              <div style={{
                height: 28,
                borderTop: '1px solid rgba(255,255,255,0.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                padding: '0 24px',
                flexShrink: 0,
              }}>
                <span style={{
                  fontSize: 10, fontFamily: 'monospace',
                  color: 'rgba(255,255,255,0.2)',
                }}>
                  {editableContent.length} chars
                  · Ctrl+S to save
                </span>
              </div>
            )}
          </div>
        )}
      </div>
  
      {/* ══════════════════════════════
          RIGHT — Version History (40%)
      ══════════════════════════════ */}
      <div style={{
        flex: 2,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        minWidth: 260,
        maxWidth: 380,
      }}>
  
        {/* Right header */}
        <div style={{
          height: 52,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          flexShrink: 0,
        }}>
          <span style={{
            fontSize: 11, fontWeight: 500,
            letterSpacing: '0.03em',
            textTransform: 'none',
            color: 'rgba(255,255,255,0.35)',
          }}>
            Version history
          </span>
          {history.length > 0 && (
            <span style={{
              fontSize: 9,
              color: 'rgba(255,255,255,0.2)',
              fontFamily: 'monospace',
            }}>
              {history.length} versions
            </span>
          )}
        </div>
  
        {/* Version list */}
        <div style={{
          flex: 1, overflowY: 'auto',
          padding: '12px 0',
        }}>
          {history.length === 0 ? (
            <div style={{
              padding: '32px 20px',
              textAlign: 'center',
              fontSize: 12,
              color: 'rgba(255,255,255,0.2)',
              lineHeight: 1.6,
            }}>
              No versions yet. Save the context 
              to create the first version.
            </div>
          ) : (
            history.map((version, i) => (
              <div key={version.id} style={{
                padding: '10px 20px',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                display: 'flex',
                gap: 12,
                alignItems: 'flex-start',
              }}>
                {/* Timeline dot + line */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  flexShrink: 0,
                  paddingTop: 3,
                }}>
                  <div style={{
                    width: 8, height: 8,
                    borderRadius: '50%',
                    background: activeContent === version.content 
                      ? accent 
                      : 'rgba(255,255,255,0.15)',
                    border: activeContent === version.content
                      ? `1px solid ${accent}`
                      : '1px solid rgba(255,255,255,0.2)',
                    flexShrink: 0,
                  }} />
                  {i < history.length - 1 && (
                    <div style={{
                      width: 1,
                      height: 32,
                      background: 'rgba(255,255,255,0.06)',
                      marginTop: 4,
                    }} />
                  )}
                </div>
  
                {/* Version info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6, marginBottom: 3,
                  }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700,
                      fontFamily: 'monospace',
                      color: activeContent === version.content 
                        ? accent 
                        : 'rgba(255,255,255,0.6)',
                    }}>
                      {version.sha || 
                        version.id.slice(0, 7)}
                    </span>
                    {i === 0 && (
                      <span style={{
                        fontSize: 8, fontWeight: 800,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        padding: '1px 5px',
                        borderRadius: 3,
                        background: hexToRgba(accent, 0.12),
                        color: accent,
                      }}>
                        Latest
                      </span>
                    )}
                  </div>
                  <div style={{
                    fontSize: 10,
                    color: 'rgba(255,255,255,0.3)',
                    marginBottom: 6,
                  }}>
                    {new Date(version.created_at)
                      .toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                  </div>
  
                  {/* Version actions */}
                  <div style={{
                    display: 'flex', gap: 6,
                  }}>
                    <button
                      onClick={() => {
                        setActiveContent(version.content)
                        setEditableContent(version.content)
                        setIsEditing(false)
                      }}
                      style={{
                        background: 'transparent',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 5,
                        padding: '3px 8px',
                        fontSize: 9, fontWeight: 700,
                        color: 'rgba(255,255,255,0.4)',
                        cursor: 'pointer',
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        transition: 'all 0.12s',
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
                      View
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
  
        {/* Compare versions section */}
        {history.length >= 2 && (
          <div style={{
            borderTop: '1px solid rgba(255,255,255,0.06)',
            padding: '16px 20px',
            flexShrink: 0,
          }}>
            <button
              onClick={() => {
                setDiffMode(!diffMode)
                if (!diffMode) {
                  setCompareFrom(history[1].id)
                  setCompareTo(history[0].id)
                }
              }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '8px',
                border: `1px solid ${
                  diffMode 
                    ? accent 
                    : 'rgba(255,255,255,0.1)'
                }`,
                borderRadius: 8,
                background: diffMode
                  ? hexToRgba(accent, 0.08)
                  : 'transparent',
                color: diffMode
                  ? accent
                  : 'rgba(255,255,255,0.4)',
                fontSize: 10, fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                transition: 'all 0.15s',
                marginBottom: diffMode ? 12 : 0,
              }}
            >
              ⊕ Compare Versions
            </button>
  
            {/* Version selectors when diff active */}
            {diffMode && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <CustomSelect
                    value={compareFrom}
                    onChange={setCompareFrom}
                    options={versionOptions}
                    width="100%"
                    compact
                  />
                  <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>→</span>
                  <CustomSelect
                    value={compareTo}
                    onChange={setCompareTo}
                    options={versionOptions}
                    width="100%"
                    compact
                  />
                </div>
              </div>
            )}
          </div>
        )}
  
        {/* Export buttons */}
        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.06)',
          padding: '14px 20px',
          display: 'flex', gap: 8,
          flexShrink: 0,
        }}>
          <button
            onClick={() => {
              if (!project || !activeContent) return
              const brief = {
                project: { name: project.name },
                phases: [], features: [],
                context: activeContent,
              }
              downloadFile(
                generateMarkdown(brief),
                `${project.name}-context.md`,
                'text/markdown'
              )
            }}
            style={{
              flex: 1,
              border: `1px solid rgba(255,255,255,0.1)`,
              borderRadius: 8,
              background: 'transparent',
              color: 'rgba(255,255,255,0.45)',
              fontSize: 9, fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              padding: '7px 0',
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
                'rgba(255,255,255,0.45)'
            }}
          >
            Export MD
          </button>
          <button
            onClick={() => {
              if (!project || !activeContent) return
              const brief = {
                project: { name: project.name },
                phases: [], features: [],
                context: activeContent,
              }
              downloadFile(
                generateJSON(brief),
                `${project.name}-context.json`,
                'application/json'
              )
            }}
            style={{
              flex: 1,
              border: `1px solid rgba(255,255,255,0.1)`,
              borderRadius: 8,
              background: 'transparent',
              color: 'rgba(255,255,255,0.45)',
              fontSize: 9, fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              padding: '7px 0',
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
                'rgba(255,255,255,0.45)'
            }}
          >
            Export JSON
          </button>
        </div>
      </div>
    </div>
  )
}
