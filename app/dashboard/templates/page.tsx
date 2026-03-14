'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useTheme } from '@/hooks/useTheme'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { Plus, Search, Trash2, Copy, Send, BookMarked, X } from 'lucide-react'

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

const CATEGORIES = [
  'ALL', 'FEATURE_BUILD', 'BUG_FIX',
  'REFACTOR', 'API_TEST', 'ARCHITECTURE',
  'GENERAL'
]

const CATEGORY_COLORS: Record<string, string> = {
  FEATURE_BUILD: '#3b82f6',
  BUG_FIX:       '#ef4444',
  REFACTOR:      '#f59e0b',
  API_TEST:      '#10b981',
  ARCHITECTURE:  '#8b5cf6',
  GENERAL:       '#6b7280',
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
        data.templates.forEach((t: Template) => t.tags?.forEach(tag => tags.add(tag)))
        setAllTags(Array.from(tags).sort())
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [activeTag, activeCategory, search])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  useEffect(() => {
    supabase.from('projects').select('id, name').then(({ data }) => {
      if (data) setProjects(data as Project[])
    })
  }, [])

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return
    const { data: { session } } = await supabase.auth.getSession()
    await fetch('/api/templates/delete', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`
      },
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
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          templateId: useTargetTemplate.id,
          projectId: selectedProject,
        })
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Template added to project')
        setShowUseModal(false)
        setUseTargetTemplate(null)
        fetchTemplates()
      }
    } catch {
      toast.error('Failed to use template')
    }
  }

  const handleSave = async (payload: Partial<Template>) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/templates/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify(payload)
      })
      const data = await res.json()
      if (data.template) {
        toast.success(payload.id ? 'Template updated' : 'Template created')
        setShowCreate(false)
        setEditTarget(null)
        fetchTemplates()
      }
    } catch {
      toast.error('Failed to save template')
    }
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 56px)', background: '#000' }}>
      <title>Reminisce — Template Library</title>

      {/* LEFT PANEL */}
      <div style={{ width: 320, flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BookMarked size={14} color={accent} />
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>Template Library</span>
          </div>
          <button onClick={() => { setEditTarget(null); setShowCreate(true); }} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: accent, color: '#000', border: 'none', borderRadius: 7, fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer' }}>
            <Plus size={12} /> New
          </button>
        </div>

        <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 12px' }}>
            <Search size={12} color="rgba(255,255,255,0.3)" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search templates..." style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 12, color: '#fff' }} />
          </div>
        </div>

        {/* Categories */}
        <div style={{ padding: '8px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setActiveCategory(cat)} style={{ padding: '3px 8px', border: `1px solid ${activeCategory === cat ? hexToRgba(accent, 0.4) : 'rgba(255,255,255,0.08)'}`, borderRadius: 5, background: activeCategory === cat ? hexToRgba(accent, 0.1) : 'transparent', color: activeCategory === cat ? accent : 'rgba(255,255,255,0.35)', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', cursor: 'pointer' }}>{cat}</button>
          ))}
        </div>

        {/* Tags */}
        {allTags.length > 0 && (
          <div style={{ padding: '8px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {activeTag && (
              <button onClick={() => setActiveTag('')} style={{ padding: '3px 8px', borderRadius: 5, background: hexToRgba(accent, 0.1), color: accent, fontSize: 9, fontWeight: 700, border: `1px solid ${accent}` }}>✕ {activeTag}</button>
            )}
            {!activeTag && allTags.map(tag => (
              <button key={tag} onClick={() => setActiveTag(tag)} style={{ padding: '3px 8px', borderRadius: 5, background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: 600, border: '1px solid rgba(255,255,255,0.08)' }}>#{tag}</button>
            ))}
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>Loading...</div> : templates.length === 0 ? <div style={{ padding: '40px 20px', textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.2)', lineHeight: 1.6 }}>No templates yet.</div> : (
            templates.map(t => (
              <div key={t.id} onClick={() => setSelected(t)} style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', background: selected?.id === t.id ? hexToRgba(accent, 0.06) : 'transparent', borderLeft: selected?.id === t.id ? `2px solid ${accent}` : '2px solid transparent' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 5 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{t.title}</span>
                  <span style={{ fontSize: 9, fontWeight: 800, color: CATEGORY_COLORS[t.category] || '#6b7280', background: `${CATEGORY_COLORS[t.category] || '#6b7280'}20`, padding: '1px 5px', borderRadius: 4 }}>{t.category.slice(0, 8)}</span>
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{t.content}</div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {!selected ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
            <BookMarked size={40} color={hexToRgba(accent, 0.3)} />
            <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.3)' }}>Select a template to view</div>
          </div>
        ) : (
          <>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>{selected.title}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <span style={{ fontSize: 9, fontWeight: 800, color: CATEGORY_COLORS[selected.category] || '#6b7280' }}>{selected.category}</span>
                  {selected.tags?.map(tag => <span key={tag} style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>#{tag}</span>)}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { navigator.clipboard.writeText(selected.content); toast.success('Copied to clipboard'); }} style={{ padding: '7px 14px', border: `1px solid ${accent}`, color: accent, background: 'transparent', borderRadius: 7, fontSize: 10, fontWeight: 800, cursor: 'pointer' }}><Copy size={12} /> Copy</button>
                <button onClick={() => { setUseTargetTemplate(selected); setShowUseModal(true); }} style={{ padding: '7px 14px', background: accent, color: '#000', border: 'none', borderRadius: 7, fontSize: 10, fontWeight: 800, cursor: 'pointer' }}><Send size={12} /> Use</button>
                <button onClick={() => handleDelete(selected.id)} style={{ padding: '7px 14px', border: '1px solid rgba(255,44,44,0.3)', color: '#ff4444', background: 'transparent', borderRadius: 7, fontSize: 10, fontWeight: 800, cursor: 'pointer' }}><Trash2 size={12} /> Delete</button>
              </div>
            </div>
            <div style={{ flex: 1, padding: 32, overflowY: 'auto' }}>
              <pre style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 24, fontSize: 13, color: 'rgba(255,255,255,0.8)', whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>{selected.content}</pre>
            </div>
          </>
        )}
      </div>

      {/* Editor Modal */}
      {showCreate && (
        <TemplateEditorModal 
          onClose={() => { setShowCreate(false); setEditTarget(null); }} 
          onSave={handleSave} 
          initialData={editTarget} 
          accent={accent} 
        />
      )}

      {/* Use in Project Modal */}
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
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ width: 600, background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 32, position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 20, right: 20, background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer' }}><X size={20} /></button>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 24, textTransform: 'uppercase' }}>{initialData ? 'Edit Template' : 'New Template'}</h2>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: 8, display: 'block' }}>Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: 12, color: '#fff', outline: 'none' }} />
          </div>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: 8, display: 'block' }}>Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)} style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: 12, color: '#fff', outline: 'none' }}>
              {CATEGORIES.filter(c => c !== 'ALL').map(c => <option key={c} value={c} style={{ background: '#000' }}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: 8, display: 'block' }}>Tags (comma separated)</label>
            <input value={tags} onChange={e => setTags(e.target.value)} style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: 12, color: '#fff', outline: 'none' }} />
          </div>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: 8, display: 'block' }}>Content</label>
            <textarea value={content} onChange={e => setContent(e.target.value)} style={{ width: '100%', height: 200, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: 12, color: '#fff', outline: 'none', resize: 'none', fontFamily: 'monospace' }} />
          </div>
        </div>

        <button onClick={() => onSave({ id: initialData?.id, title, content, category, tags: tags.split(',').map((s: string) => s.trim()).filter(Boolean) })} style={{ width: '100%', marginTop: 24, padding: 14, background: accent, color: '#000', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 800, textTransform: 'uppercase', cursor: 'pointer' }}>Save Template</button>
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
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ width: 400, background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 32, position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 20, right: 20, background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer' }}><X size={20} /></button>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 24, textTransform: 'uppercase' }}>Use Template</h2>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: 8, display: 'block' }}>Select Project</label>
            <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)} style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: 12, color: '#fff', outline: 'none' }}>
              <option value="" style={{ background: '#000' }}>Select...</option>
              {projects.map((p: Project) => <option key={p.id} value={p.id} style={{ background: '#000' }}>{p.name}</option>)}
            </select>
          </div>
        </div>

        <button onClick={onConfirm} disabled={!selectedProject} style={{ width: '100%', marginTop: 24, padding: 14, background: accent, color: '#000', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 800, textTransform: 'uppercase', cursor: 'pointer', opacity: selectedProject ? 1 : 0.5 }}>Confirm Deployment</button>
      </div>
    </div>
  )
}
