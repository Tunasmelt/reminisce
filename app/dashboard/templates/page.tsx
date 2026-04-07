'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useTheme } from '@/hooks/useTheme'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { Plus, Search, Trash2, Copy, Send, BookMarked, X, Clock, Tag } from 'lucide-react'

interface Template {
  id: string
  title: string
  content: string
  tags: string[]
  category: string
  use_count: number
  created_at: string
  updated_at: string
}

interface Project {
  id: string
  name: string
}

function hexToRgba(hex: string, a: number) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

const CATEGORIES = ['ALL', 'FEATURE_BUILD', 'BUG_FIX', 'REFACTOR', 'API_TEST', 'ARCHITECTURE', 'GENERAL']

const CATEGORY_META: Record<string, { color: string; label: string }> = {
  FEATURE_BUILD: { color: '#3b82f6', label: 'Feature' },
  BUG_FIX:       { color: '#ef4444', label: 'Bug Fix' },
  REFACTOR:      { color: '#f59e0b', label: 'Refactor' },
  API_TEST:      { color: '#10b981', label: 'API Test' },
  ARCHITECTURE:  { color: '#8b5cf6', label: 'Architecture' },
  GENERAL:       { color: '#6b7280', label: 'General' },
}

export default function TemplateLibraryPage() {
  const { accent } = useTheme()
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('ALL')
  const [activeTag, setActiveTag] = useState('')
  const [allTags, setAllTags] = useState<string[]>([])
  const [selected, setSelected] = useState<Template | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [editTarget, setEditTarget] = useState<Template | null>(null)
  const [showUseModal, setShowUseModal] = useState(false)
  const [useTargetTemplate, setUseTargetTemplate] = useState<Template | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState('')

  const fetchTemplates = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const params = new URLSearchParams()
      if (activeTag) params.set('tag', activeTag)
      if (activeCategory !== 'ALL') params.set('category', activeCategory)
      if (search) params.set('search', search)
      const res = await fetch(`/api/templates/list?${params}`, {
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      })
      const data = await res.json()
      if (data.templates) {
        setTemplates(data.templates)
        const tags = new Set<string>()
        data.templates.forEach((t: Template) => t.tags?.forEach((tag: string) => tags.add(tag)))
        setAllTags(Array.from(tags).sort())
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [activeTag, activeCategory, search])

  useEffect(() => { fetchTemplates() }, [fetchTemplates])

  useEffect(() => {
    supabase.from('projects').select('id, name').then(({ data }) => {
      if (data) setProjects(data as Project[])
    })
  }, [])

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this template?')) return
    const { data: { session } } = await supabase.auth.getSession()
    await fetch('/api/templates/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
      body: JSON.stringify({ id })
    })
    toast.success('Template deleted')
    if (selected?.id === id) setSelected(null)
    fetchTemplates()
  }

  const handleUseInProject = async () => {
    if (!useTargetTemplate || !selectedProject) return
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/templates/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ templateId: useTargetTemplate.id, projectId: selectedProject })
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Template added to project')
        setShowUseModal(false)
        setUseTargetTemplate(null)
        fetchTemplates()
      }
    } catch { toast.error('Failed to use template') }
  }

  const handleSave = async (payload: Partial<Template>) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/templates/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify(payload)
      })
      const data = await res.json()
      if (data.template) {
        toast.success(payload.id ? 'Template updated' : 'Template created')
        setShowCreate(false)
        setEditTarget(null)
        fetchTemplates()
      }
    } catch { toast.error('Failed to save template') }
  }

  const catMeta = CATEGORY_META[selected?.category || '']

  return (
    <div style={{
      display: 'flex',
      height: 'calc(100vh - 68px)',
      background: 'linear-gradient(160deg, rgba(var(--accent-rgb),0.03) 0%, transparent 40%), #07070f',
      overflow: 'hidden',
    }}>
      <title>Reminisce — Template Library</title>

      {/* ── LEFT PANEL ──────────────────────── */}
      <div style={{
        width: 300,
        flexShrink: 0,
        borderRight: '1px solid rgba(255,255,255,0.07)',
        display: 'flex',
        flexDirection: 'column',
        background: 'rgba(255,255,255,0.02)',
        backdropFilter: 'blur(12px)',
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BookMarked size={14} color={accent} />
            <span style={{
              fontSize: 11, fontWeight: 800,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.6)',
            }}>
              Templates
            </span>
            <span style={{
              fontSize: 9, fontWeight: 700,
              padding: '2px 6px',
              borderRadius: 999,
              background: hexToRgba(accent, 0.1),
              color: accent,
              border: `1px solid ${hexToRgba(accent, 0.2)}`,
            }}>
              {templates.length}
            </span>
          </div>
          <button
            onClick={() => { setEditTarget(null); setShowCreate(true) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '6px 12px',
              background: accent, color: '#000',
              border: 'none', borderRadius: 8,
              fontSize: 10, fontWeight: 800,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            <Plus size={11} /> New
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 10, padding: '8px 12px',
          }}>
            <Search size={11} color="rgba(255,255,255,0.3)" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search templates..."
              style={{
                flex: 1, background: 'transparent',
                border: 'none', outline: 'none',
                fontSize: 12, color: '#fff',
              }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', padding: 0 }}>
                <X size={11} />
              </button>
            )}
          </div>
        </div>

        {/* Categories */}
        <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              style={{
                padding: '3px 9px',
                border: `1px solid ${activeCategory === cat ? hexToRgba(accent, 0.4) : 'rgba(255,255,255,0.07)'}`,
                borderRadius: 6,
                background: activeCategory === cat ? hexToRgba(accent, 0.1) : 'transparent',
                color: activeCategory === cat ? accent : 'rgba(255,255,255,0.3)',
                fontSize: 9, fontWeight: 700,
                textTransform: 'uppercase',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {cat === 'ALL' ? 'All' : (CATEGORY_META[cat]?.label || cat)}
            </button>
          ))}
        </div>

        {/* Tags */}
        {allTags.length > 0 && (
          <div style={{ padding: '8px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
            <Tag size={9} color="rgba(255,255,255,0.2)" />
            {activeTag
              ? <button onClick={() => setActiveTag('')} style={{ padding: '2px 7px', borderRadius: 5, background: hexToRgba(accent, 0.1), color: accent, fontSize: 9, fontWeight: 700, border: `1px solid ${hexToRgba(accent, 0.3)}`, cursor: 'pointer' }}>✕ {activeTag}</button>
              : allTags.map(tag => (
                <button key={tag} onClick={() => setActiveTag(tag)} style={{ padding: '2px 7px', borderRadius: 5, background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.35)', fontSize: 9, fontWeight: 600, border: '1px solid rgba(255,255,255,0.07)', cursor: 'pointer', transition: 'all 0.15s' }}>
                  #{tag}
                </button>
              ))
            }
          </div>
        )}

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto' }} className="hide-scrollbar">
          {loading ? (
            <div style={{ padding: 24, textAlign: 'center' }}>
              {[1,2,3].map(i => (
                <div key={i} style={{ height: 60, background: 'rgba(255,255,255,0.03)', borderRadius: 8, marginBottom: 8, animation: 'skeletonPulse 1.5s ease infinite' }} />
              ))}
            </div>
          ) : templates.length === 0 ? (
            <div style={{ padding: '48px 20px', textAlign: 'center' }}>
              <BookMarked size={28} color={hexToRgba(accent, 0.2)} style={{ margin: '0 auto 12px' }} />
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)', lineHeight: 1.6 }}>
                No templates yet.<br />Create your first one.
              </div>
            </div>
          ) : templates.map(t => {
            const isSelected = selected?.id === t.id
            const meta = CATEGORY_META[t.category]
            return (
              <div
                key={t.id}
                onClick={() => setSelected(t)}
                style={{
                  padding: '14px 16px',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  cursor: 'pointer',
                  background: isSelected ? hexToRgba(accent, 0.06) : 'transparent',
                  borderLeft: `3px solid ${isSelected ? accent : 'transparent'}`,
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 5 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', flex: 1, lineHeight: 1.3 }}>{t.title}</span>
                  <span style={{
                    fontSize: 8, fontWeight: 800,
                    color: meta?.color || '#6b7280',
                    background: `${meta?.color || '#6b7280'}18`,
                    padding: '2px 6px', borderRadius: 4,
                    border: `1px solid ${meta?.color || '#6b7280'}30`,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    flexShrink: 0,
                  }}>
                    {meta?.label || t.category}
                  </span>
                </div>
                <div style={{
                  fontSize: 11, color: 'rgba(255,255,255,0.35)',
                  overflow: 'hidden',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  lineHeight: 1.5,
                  marginBottom: t.tags?.length ? 6 : 0,
                }}>
                  {t.content}
                </div>
                {t.tags?.length > 0 && (
                  <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                    {t.tags.slice(0, 3).map(tag => (
                      <span key={tag} style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.04)', padding: '1px 5px', borderRadius: 3 }}>#{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── RIGHT PANEL ─────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {!selected ? (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 16,
            padding: 40,
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: 16,
              background: hexToRgba(accent, 0.08),
              border: `1px solid ${hexToRgba(accent, 0.15)}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <BookMarked size={28} color={hexToRgba(accent, 0.5)} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>
                Select a template
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)', maxWidth: 280, lineHeight: 1.6 }}>
                Pick one from the list to preview its content and deploy it to a project.
              </div>
            </div>
            <button
              onClick={() => { setEditTarget(null); setShowCreate(true) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '10px 20px',
                background: hexToRgba(accent, 0.1),
                border: `1px solid ${hexToRgba(accent, 0.2)}`,
                borderRadius: 10, color: accent,
                fontSize: 12, fontWeight: 700,
                cursor: 'pointer', transition: 'all 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = hexToRgba(accent, 0.16)}
              onMouseLeave={e => e.currentTarget.style.background = hexToRgba(accent, 0.1)}
            >
              <Plus size={14} /> Create your first template
            </button>
          </div>
        ) : (
          <>
            {/* Detail header */}
            <div style={{
              padding: '18px 28px',
              borderBottom: '1px solid rgba(255,255,255,0.07)',
              display: 'flex', alignItems: 'flex-start',
              justifyContent: 'space-between', gap: 16,
              background: 'rgba(255,255,255,0.02)',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <h2 style={{ fontSize: 18, fontWeight: 800, color: '#fff', margin: 0 }}>
                    {selected.title}
                  </h2>
                  {catMeta && (
                    <span style={{
                      fontSize: 9, fontWeight: 800,
                      padding: '3px 8px', borderRadius: 5,
                      background: `${catMeta.color}18`,
                      color: catMeta.color,
                      border: `1px solid ${catMeta.color}30`,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      flexShrink: 0,
                    }}>
                      {catMeta.label}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  {selected.tags?.map(tag => (
                    <span key={tag} style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>#{tag}</span>
                  ))}
                  {selected.use_count > 0 && (
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={9} /> Used {selected.use_count} time{selected.use_count !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button
                  onClick={() => { navigator.clipboard.writeText(selected.content); toast.success('Copied') }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '7px 14px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: 'rgba(255,255,255,0.6)',
                    background: 'rgba(255,255,255,0.04)',
                    borderRadius: 8, fontSize: 10,
                    fontWeight: 700, cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'; e.currentTarget.style.color = '#fff' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)' }}
                >
                  <Copy size={11} /> Copy
                </button>
                <button
                  onClick={() => { setUseTargetTemplate(selected); setShowUseModal(true) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '7px 14px',
                    background: accent, color: '#000',
                    border: 'none', borderRadius: 8,
                    fontSize: 10, fontWeight: 800,
                    cursor: 'pointer', transition: 'opacity 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                >
                  <Send size={11} /> Use in Project
                </button>
                <button
                  onClick={() => handleDelete(selected.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '7px 12px',
                    border: '1px solid rgba(239,68,68,0.2)',
                    color: 'rgba(239,68,68,0.6)',
                    background: 'transparent',
                    borderRadius: 8, fontSize: 10,
                    fontWeight: 700, cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.color = '#ef4444' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(239,68,68,0.2)'; e.currentTarget.style.color = 'rgba(239,68,68,0.6)' }}
                >
                  <Trash2 size={11} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div style={{ flex: 1, padding: '28px 32px', overflowY: 'auto' }} className="hide-scrollbar">
              <pre style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 14, padding: '24px 28px',
                fontSize: 13, color: 'rgba(255,255,255,0.8)',
                whiteSpace: 'pre-wrap',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                lineHeight: 1.75, margin: 0,
              }}>
                {selected.content}
              </pre>
            </div>
          </>
        )}
      </div>

      {/* Editor modal */}
      {showCreate && (
        <TemplateEditorModal
          onClose={() => { setShowCreate(false); setEditTarget(null) }}
          onSave={handleSave}
          initialData={editTarget}
          accent={accent}
        />
      )}

      {/* Use in project modal */}
      {showUseModal && (
        <UseInProjectModal
          projects={projects}
          onClose={() => setShowUseModal(false)}
          onConfirm={handleUseInProject}
          selectedProject={selectedProject}
          setSelectedProject={setSelectedProject}
          accent={accent}
        />
      )}
    </div>
  )
}

interface EditorModalProps {
  onClose: () => void
  onSave: (payload: Partial<Template>) => void
  initialData: Template | null
  accent: string
}

function TemplateEditorModal({ onClose, onSave, initialData, accent }: EditorModalProps) {
  const [title, setTitle] = useState(initialData?.title || '')
  const [content, setContent] = useState(initialData?.content || '')
  const [category, setCategory] = useState(initialData?.category || 'GENERAL')
  const [tags, setTags] = useState(initialData?.tags?.join(', ') || '')


  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.7)',
      backdropFilter: 'blur(16px)',
      display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 100,
    }}>
      <div style={{
        width: 580,
        background: 'rgba(10,10,24,0.98)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 20, padding: 36,
        position: 'relative',
        boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
      }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 18, right: 18, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: 'rgba(255,255,255,0.5)', cursor: 'pointer', padding: '4px 6px', display: 'flex' }}>
          <X size={16} />
        </button>
        <h2 style={{ fontSize: 17, fontWeight: 800, color: '#fff', margin: '0 0 28px' }}>
          {initialData ? 'Edit Template' : 'New Template'}
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[
            { label: 'Title', value: title, onChange: (v: string) => setTitle(v), type: 'input' },
          ].map(f => (
            <div key={f.label}>
              <label style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, display: 'block' }}>{f.label}</label>
              <input value={f.value} onChange={e => f.onChange(e.target.value)} style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 14px', color: '#fff', outline: 'none', fontSize: 13, boxSizing: 'border-box' }} />
            </div>
          ))}
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, display: 'block' }}>Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)} style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 14px', color: '#fff', outline: 'none', fontSize: 13 }}>
              {CATEGORIES.filter(c => c !== 'ALL').map(c => <option key={c} value={c} style={{ background: '#0a0a18' }}>{CATEGORY_META[c]?.label || c}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, display: 'block' }}>Tags <span style={{ color: 'rgba(255,255,255,0.2)', fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>(comma separated)</span></label>
            <input value={tags} onChange={e => setTags(e.target.value)} placeholder="auth, api, setup..." style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 14px', color: '#fff', outline: 'none', fontSize: 13, boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, display: 'block' }}>Content</label>
            <textarea value={content} onChange={e => setContent(e.target.value)} style={{ width: '100%', height: 180, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 14px', color: '#fff', outline: 'none', resize: 'none', fontFamily: 'ui-monospace, monospace', fontSize: 12, lineHeight: 1.6, boxSizing: 'border-box' }} />
          </div>
        </div>
        <button
          onClick={() => onSave({ id: initialData?.id, title, content, category, tags: tags.split(',').map((s: string) => s.trim()).filter(Boolean) })}
          style={{
            width: '100%', marginTop: 24,
            padding: '13px', background: accent,
            color: '#000', border: 'none',
            borderRadius: 10, fontSize: 12,
            fontWeight: 800, textTransform: 'uppercase',
            letterSpacing: '0.08em', cursor: 'pointer',
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          Save Template
        </button>
      </div>
    </div>
  )
}

interface UseModalProps {
  projects: Project[]
  onClose: () => void
  onConfirm: () => void
  selectedProject: string
  setSelectedProject: (id: string) => void
  accent: string
}

function UseInProjectModal({ projects, onClose, onConfirm, selectedProject, setSelectedProject, accent }: UseModalProps) {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.7)',
      backdropFilter: 'blur(16px)',
      display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 100,
    }}>
      <div style={{
        width: 380,
        background: 'rgba(10,10,24,0.98)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 20, padding: 32,
        position: 'relative',
        boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
      }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 18, right: 18, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: 'rgba(255,255,255,0.5)', cursor: 'pointer', padding: '4px 6px', display: 'flex' }}>
          <X size={16} />
        </button>
        <h2 style={{ fontSize: 17, fontWeight: 800, color: '#fff', margin: '0 0 6px' }}>Use Template</h2>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', margin: '0 0 24px', lineHeight: 1.5 }}>
          Select which project to add this template to.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
          {projects.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>No projects yet</div>
          ) : projects.map(p => (
            <button
              key={p.id}
              onClick={() => setSelectedProject(p.id)}
              style={{
                padding: '12px 16px',
                background: selectedProject === p.id ? `rgba(var(--accent-rgb), 0.1)` : 'rgba(255,255,255,0.03)',
                border: `1px solid ${selectedProject === p.id ? `rgba(var(--accent-rgb), 0.3)` : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 10,
                color: selectedProject === p.id ? '#fff' : 'rgba(255,255,255,0.55)',
                fontSize: 13, fontWeight: 600,
                textAlign: 'left', cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {p.name}
            </button>
          ))}
        </div>
        <button
          onClick={onConfirm}
          disabled={!selectedProject}
          style={{
            width: '100%', padding: '13px',
            background: accent, color: '#000',
            border: 'none', borderRadius: 10,
            fontSize: 12, fontWeight: 800,
            textTransform: 'uppercase', letterSpacing: '0.08em',
            cursor: selectedProject ? 'pointer' : 'not-allowed',
            opacity: selectedProject ? 1 : 0.4,
            transition: 'opacity 0.15s',
          }}
        >
          Deploy to Project
        </button>
      </div>
    </div>
  )
}
