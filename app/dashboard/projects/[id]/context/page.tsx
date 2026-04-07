'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/hooks/useTheme'
import DiffViewer from '@/components/DiffViewer'
import CustomSelect from '@/components/CustomSelect'
import { downloadFile } from '@/lib/exportBrief'
import { useFileSystem } from '@/hooks/useFileSystem'
import { FolderOpen, Upload, Download, GitBranch, AlertTriangle, Check } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ContextFile {
  id:             string
  file_path:      string
  content:        string | null
  summary:        string | null
  owned_by:       string | null
  file_hash:      string | null
  last_synced_at: string | null
  last_modified:  string | null
  version:        number | null
}

interface Version {
  id:         string
  content:    string
  changed_at: string
  sha:        string | null
}

function hexToRgba(hex: string, a: number) {
  if (!hex || hex.length < 7) return `rgba(0,0,0,${a})`
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

// Friendly display name for a file path
function fileLabel(path: string): string {
  const parts = path.split('/')
  return parts[parts.length - 1]
}

// Short folder label for grouping
function folderLabel(path: string): string {
  const parts = path.split('/')
  // reminisce/context/architecture.md → context
  if (parts.length >= 3) return parts[parts.length - 2]
  return parts[0]
}

// Ownership badge colour
function ownedByColour(ownedBy: string | null): string {
  if (ownedBy === 'developer') return '#10b981'
  if (ownedBy === 'shared')    return '#f59e0b'
  return '#6b7280' // reminisce (default)
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ContextPage() {
  const params    = useParams()
  const { accent } = useTheme()
  const projectId  = params.id as string

  // ── File system hook — Phase 2 additions ───────────────────────────────────
  const {
    isConnected, isSupported,
    openFolder,
    gitState, pendingChanges,
    syncFromLocal, pushToLocal,
  } = useFileSystem(projectId)

  // ── Data ───────────────────────────────────────────────────────────────────
  const [project,       setProject]       = useState<{ name: string } | null>(null)
  const [contextFiles,  setContextFiles]  = useState<ContextFile[]>([])
  const [selectedFile,  setSelectedFile]  = useState<ContextFile | null>(null)
  const [loading,       setLoading]       = useState(true)

  // ── Edit state ─────────────────────────────────────────────────────────────
  const [isEditing,       setIsEditing]       = useState(false)
  const [editableContent, setEditableContent] = useState('')
  const [isSaving,        setIsSaving]        = useState(false)

  // ── Version history ────────────────────────────────────────────────────────
  const [versions,     setVersions]     = useState<Version[]>([])
  const [versionsLoading, setVersionsLoading] = useState(false)
  const [showDiff,     setShowDiff]     = useState(false)
  const [diffFrom,     setDiffFrom]     = useState('')
  const [diffTo,       setDiffTo]       = useState('')

  // ── Conflict state — from pendingChanges ───────────────────────────────────
  const [showSyncConfirm,  setShowSyncConfirm]  = useState(false)
  const [isSyncing,        setIsSyncing]        = useState(false)
  const [isPushing,        setIsPushing]        = useState(false)

  // ── Load all context files ─────────────────────────────────────────────────
  const loadFiles = useCallback(async () => {
    setLoading(true)
    try {
      const [{ data: proj }, { data: files }] = await Promise.all([
        supabase.from('projects').select('name').eq('id', projectId).single(),
        supabase
          .from('contexts')
          .select('id, file_path, content, summary, owned_by, file_hash, last_synced_at, last_modified, version')
          .eq('project_id', projectId)
          .order('file_path', { ascending: true }),
      ])
      if (proj)   setProject(proj)
      if (files) {
        setContextFiles(files as ContextFile[])
        // Auto-select the master prompt or architecture file if nothing is selected
        if (!selectedFile && files.length > 0) {
          const master = files.find(f => f.file_path.includes('master-prompt'))
            ?? files.find(f => f.file_path.includes('architecture'))
            ?? files[0]
          setSelectedFile(master as ContextFile)
          setEditableContent(master.content ?? '')
        }
      }
    } catch (err) {
      console.error(err)
      toast.error('Failed to load context files')
    } finally {
      setLoading(false)
    }
  }, [projectId, selectedFile])

  useEffect(() => { loadFiles() }, [projectId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load version history for selected file ─────────────────────────────────
  const loadVersions = useCallback(async (filePath: string) => {
    setVersionsLoading(true)
    setVersions([])
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(
        `/api/context/history?projectId=${projectId}&filePath=${encodeURIComponent(filePath)}`,
        { headers: { Authorization: `Bearer ${session?.access_token}` } },
      )
      const data = await res.json()
      if (data.versions) setVersions(data.versions as Version[])
    } catch { /* non-fatal */ }
    finally { setVersionsLoading(false) }
  }, [projectId])

  useEffect(() => {
    if (selectedFile) {
      setIsEditing(false)
      setShowDiff(false)
      setEditableContent(selectedFile.content ?? '')
      loadVersions(selectedFile.file_path)
    }
  }, [selectedFile?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Save edited file content ───────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!selectedFile) return
    setIsSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/context/version', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          projectId,
          filePath: selectedFile.file_path,
          content:  editableContent,
        }),
      })
      if (!res.ok) throw new Error(await res.text())

      // Update local state
      setContextFiles(prev => prev.map(f =>
        f.id === selectedFile.id
          ? { ...f, content: editableContent }
          : f,
      ))
      setSelectedFile(prev => prev ? { ...prev, content: editableContent } : prev)
      setIsEditing(false)
      toast.success('Saved')
      loadVersions(selectedFile.file_path)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setIsSaving(false)
    }
  }, [selectedFile, editableContent, projectId, loadVersions])

  // Ctrl+S / Cmd+S shortcut
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's' && isEditing) {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [isEditing, handleSave])

  // ── Sync from local folder → DB ────────────────────────────────────────────
  const handleSyncFromLocal = useCallback(async () => {
    setIsSyncing(true)
    try {
      await syncFromLocal()
      await loadFiles()
      toast.success('Synced from local folder')
    } catch { /* error already toasted by hook */ }
    finally {
      setIsSyncing(false)
      setShowSyncConfirm(false)
    }
  }, [syncFromLocal, loadFiles])

  // ── Push DB content → local folder ────────────────────────────────────────
  const handlePushToLocal = useCallback(async () => {
    setIsPushing(true)
    try {
      // Push all Reminisce-owned files to local
      const filesToPush: Record<string, string> = {}
      contextFiles
        .filter(f => f.owned_by !== 'developer' && f.content)
        .forEach(f => { filesToPush[f.file_path] = f.content! })

      const written = await pushToLocal(filesToPush)
      toast.success(`${written} file${written !== 1 ? 's' : ''} written to local folder`)
      // Update last_synced_at timestamp in local state
      const now = new Date().toISOString()
      setContextFiles(prev => prev.map(f =>
        f.owned_by !== 'developer' ? { ...f, last_synced_at: now } : f,
      ))
    } catch { /* error already toasted by hook */ }
    finally { setIsPushing(false) }
  }, [contextFiles, pushToLocal])

  // ── Group files by folder ──────────────────────────────────────────────────
  const grouped = contextFiles.reduce((acc, f) => {
    const folder = folderLabel(f.file_path)
    acc[folder] = [...(acc[folder] ?? []), f]
    return acc
  }, {} as Record<string, ContextFile[]>)

  // Determine if selected file has local changes pending
  const pendingForSelected = pendingChanges.find(
    c => c.filePath === selectedFile?.file_path,
  )

  // Version options for diff picker
  const versionOptions = versions.map((v, i) => ({
    value: v.id,
    label: `v${versions.length - i} — ${new Date(v.changed_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
  }))

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{
      display: 'flex', height: 'calc(100vh - 68px)',
      background: 'linear-gradient(160deg, rgba(var(--accent-rgb),0.04) 0%, transparent 50%), #07070f',
      overflow: 'hidden',
    }}>
      <title>{`Reminisce — Context — ${project?.name ?? ''}`}</title>

      {/* ═══════════════════════════════════════
          LEFT — File tree (240px)
      ═══════════════════════════════════════ */}
      <div style={{
        width: 240, flexShrink: 0, display: 'flex', flexDirection: 'column',
        borderRight: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(255,255,255,0.02)',
      }}>
        {/* File tree header */}
        <div style={{
          padding: '14px 16px 10px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          background: 'rgba(8,8,20,0.6)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 10 }}>
            Context Files
          </div>

          {/* Git state bar */}
          {gitState.branch && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, padding: '5px 8px', background: 'rgba(255,255,255,0.04)', borderRadius: 6 }}>
              <GitBranch size={10} color="rgba(255,255,255,0.3)" />
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {gitState.branch}
              </span>
            </div>
          )}

          {/* Folder connect / sync controls */}
          {isSupported && !isConnected ? (
            <button
              onClick={openFolder}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', background: hexToRgba(accent, 0.08), border: `1px solid ${hexToRgba(accent, 0.25)}`, borderRadius: 7, cursor: 'pointer', fontSize: 10, fontWeight: 700, color: accent }}
            >
              <FolderOpen size={12} />
              Connect folder
            </button>
          ) : isConnected ? (
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={() => setShowSyncConfirm(true)}
                disabled={isSyncing}
                title="Pull from local → DB"
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '6px', background: pendingChanges.length > 0 ? hexToRgba('#f59e0b', 0.12) : 'rgba(255,255,255,0.04)', border: `1px solid ${pendingChanges.length > 0 ? 'rgba(245,158,11,0.35)' : 'rgba(255,255,255,0.1)'}`, borderRadius: 7, cursor: isSyncing ? 'not-allowed' : 'pointer', fontSize: 9, fontWeight: 700, color: pendingChanges.length > 0 ? '#f59e0b' : 'rgba(255,255,255,0.4)' }}
              >
                <Upload size={11} />
                {isSyncing ? 'Syncing…' : `Pull${pendingChanges.length > 0 ? ` (${pendingChanges.length})` : ''}`}
              </button>
              <button
                onClick={handlePushToLocal}
                disabled={isPushing}
                title="Push DB → local"
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '6px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, cursor: isPushing ? 'not-allowed' : 'pointer', fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.4)' }}
              >
                <Download size={11} />
                {isPushing ? 'Pushing…' : 'Push'}
              </button>
            </div>
          ) : null}
        </div>

        {/* File list */}
        <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none', padding: '8px 0' }}>
          {loading ? (
            <div style={{ padding: '24px 16px', fontSize: 11, color: 'rgba(255,255,255,0.2)', textAlign: 'center' }}>Loading…</div>
          ) : contextFiles.length === 0 ? (
            <div style={{ padding: '24px 16px', fontSize: 11, color: 'rgba(255,255,255,0.2)', textAlign: 'center', lineHeight: 1.6 }}>
              No context files yet.<br />Run the Wizard to generate your blueprint.
            </div>
          ) : (
            Object.entries(grouped).map(([folder, files]) => (
              <div key={folder} style={{ marginBottom: 4 }}>
                <div style={{ padding: '5px 16px', fontSize: 8, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.2)' }}>
                  {folder}/
                </div>
                {files.map(f => {
                  const isSelected   = selectedFile?.id === f.id
                  const hasPending   = pendingChanges.some(c => c.filePath === f.file_path)
                  const ownerColour  = ownedByColour(f.owned_by)
                  return (
                    <div
                      key={f.id}
                      onClick={() => { setSelectedFile(f); setIsEditing(false) }}
                      style={{
                        padding: '7px 16px 7px 20px',
                        cursor: 'pointer',
                        background: isSelected ? hexToRgba(accent, 0.08) : 'transparent',
                        borderLeft: `2px solid ${isSelected ? accent : 'transparent'}`,
                        display: 'flex', alignItems: 'center', gap: 8,
                        transition: 'all 0.1s',
                      }}
                      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
                      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: isSelected ? 600 : 400, color: isSelected ? '#fff' : 'rgba(255,255,255,0.6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {fileLabel(f.file_path)}
                        </div>
                      </div>
                      {/* Conflict indicator */}
                      {hasPending && (
                        <AlertTriangle size={9} color="#f59e0b" />
                      )}
                      {/* Ownership dot */}
                      <div title={`Owned by: ${f.owned_by ?? 'reminisce'}`} style={{ width: 5, height: 5, borderRadius: '50%', background: ownerColour, flexShrink: 0 }} />
                    </div>
                  )
                })}
              </div>
            ))
          )}
        </div>

        {/* Ownership legend */}
        <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 12 }}>
          {[
            { colour: '#6b7280', label: 'Reminisce' },
            { colour: '#10b981', label: 'Dev' },
            { colour: '#f59e0b', label: 'Shared' },
          ].map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: l.colour }} />
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)' }}>{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════
          CENTRE — File editor (flex: 3)
      ═══════════════════════════════════════ */}
      <div style={{ flex: 3, display: 'flex', flexDirection: 'column', minWidth: 0, borderRight: '1px solid rgba(255,255,255,0.08)' }}>

        {/* Editor header */}
        <div style={{
          height: 52, flexShrink: 0,
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(8,8,20,0.6)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 20px', gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            {selectedFile && (
              <>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 280 }}>
                  {selectedFile.file_path}
                </span>
                {/* Owned-by badge */}
                <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '2px 7px', borderRadius: 4, background: `${ownedByColour(selectedFile.owned_by)}20`, color: ownedByColour(selectedFile.owned_by), border: `1px solid ${ownedByColour(selectedFile.owned_by)}40`, flexShrink: 0 }}>
                  {selectedFile.owned_by ?? 'reminisce'}
                </span>
                {/* Conflict badge */}
                {pendingForSelected && (
                  <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '2px 7px', borderRadius: 4, background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.35)', flexShrink: 0 }}>
                    Local changes
                  </span>
                )}
                {/* Unsaved indicator */}
                {isEditing && editableContent !== (selectedFile.content ?? '') && (
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b', display: 'inline-block', flexShrink: 0 }} title="Unsaved changes" />
                )}
              </>
            )}
          </div>

          {/* Editor controls */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
            {selectedFile && !isEditing && (
              <button
                onClick={() => { setShowDiff(!showDiff); setIsEditing(false) }}
                style={{ padding: '5px 12px', background: showDiff ? hexToRgba(accent, 0.1) : 'transparent', border: `1px solid ${showDiff ? hexToRgba(accent, 0.4) : 'rgba(255,255,255,0.1)'}`, borderRadius: 7, cursor: 'pointer', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: showDiff ? accent : 'rgba(255,255,255,0.4)' }}
              >
                Diff
              </button>
            )}
            {/* Edit / View toggle */}
            {selectedFile && selectedFile.owned_by !== 'developer' && (
              <div style={{ display: 'flex', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, overflow: 'hidden' }}>
                {(['view', 'edit'] as const).map(mode => {
                  const active = (mode === 'edit') === isEditing
                  return (
                    <button
                      key={mode}
                      onClick={() => {
                        if (mode === 'edit') { setShowDiff(false); setIsEditing(true); setEditableContent(selectedFile.content ?? '') }
                        else { setIsEditing(false) }
                      }}
                      style={{ padding: '5px 14px', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', border: 'none', borderRight: mode === 'view' ? '1px solid rgba(255,255,255,0.1)' : 'none', background: active ? 'rgba(255,255,255,0.08)' : 'transparent', color: active ? '#fff' : 'rgba(255,255,255,0.35)', cursor: 'pointer', transition: 'all 0.15s' }}
                    >
                      {mode}
                    </button>
                  )
                })}
              </div>
            )}
            {isEditing && (
              <button
                onClick={handleSave}
                disabled={isSaving}
                style={{ background: isSaving ? 'rgba(255,255,255,0.1)' : accent, color: isSaving ? 'rgba(255,255,255,0.3)' : '#000', border: 'none', borderRadius: 7, padding: '6px 16px', fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: isSaving ? 'not-allowed' : 'pointer' }}
              >
                {isSaving ? 'Saving…' : 'Save'}
              </button>
            )}
          </div>
        </div>

        {/* Conflict resolution banner */}
        {pendingForSelected && !showDiff && (
          <div style={{ padding: '10px 20px', background: 'rgba(245,158,11,0.08)', borderBottom: '1px solid rgba(245,158,11,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={13} color="#f59e0b" />
              <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600 }}>
                Local file differs from Reminisce — {pendingForSelected.filePath.split('/').pop()}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => { setShowDiff(true); setDiffFrom('local'); setDiffTo('db') }}
                style={{ padding: '5px 12px', fontSize: 10, fontWeight: 700, background: 'transparent', border: '1px solid rgba(245,158,11,0.4)', borderRadius: 6, color: '#f59e0b', cursor: 'pointer' }}
              >
                Review diff
              </button>
              <button
                onClick={() => syncFromLocal([pendingForSelected.filePath]).then(() => loadFiles())}
                style={{ padding: '5px 12px', fontSize: 10, fontWeight: 700, background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)', borderRadius: 6, color: '#f59e0b', cursor: 'pointer' }}
              >
                Keep local
              </button>
            </div>
          </div>
        )}

        {/* Editor body */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {!selectedFile ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>
              Select a file from the left panel
            </div>
          ) : showDiff && versions.length >= 2 ? (
            <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
                <CustomSelect value={diffFrom} onChange={setDiffFrom} options={versionOptions} width={220} compact />
                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>→</span>
                <CustomSelect value={diffTo} onChange={setDiffTo} options={versionOptions} width={220} compact />
              </div>
              {diffFrom && diffTo && diffFrom !== diffTo && (() => {
                // When comparing local vs DB
                if (diffFrom === 'local' && pendingForSelected) {
                  return <DiffViewer
                    oldContent={pendingForSelected.dbContent}
                    newContent={pendingForSelected.localContent}
                    oldLabel="Reminisce (DB)"
                    newLabel="Local file"
                  />
                }
                const fromV = versions.find(v => v.id === diffFrom)
                const toV   = versions.find(v => v.id === diffTo)
                if (!fromV || !toV) return null
                return <DiffViewer
                  oldContent={fromV.content}
                  newContent={toV.content}
                  oldLabel={`v${versions.indexOf(fromV) + 1} (older)`}
                  newLabel={`v${versions.indexOf(toV) + 1} (newer)`}
                />
              })()}
            </div>
          ) : isEditing ? (
            <textarea
              value={editableContent}
              onChange={e => setEditableContent(e.target.value)}
              style={{ flex: 1, width: '100%', background: 'rgba(255,255,255,0.02)', border: 'none', outline: 'none', resize: 'none', padding: '24px 28px', fontFamily: 'ui-monospace, monospace', fontSize: 12, color: 'rgba(255,255,255,0.85)', lineHeight: 1.75, boxSizing: 'border-box' }}
              placeholder="Edit context file content…"
              spellCheck={false}
            />
          ) : (
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px', fontFamily: 'ui-monospace, monospace', fontSize: 12, lineHeight: 1.8, color: 'rgba(255,255,255,0.7)', whiteSpace: 'pre-wrap' }}>
              {selectedFile.content ? (
                <>
                  {/* Show summary if present */}
                  {selectedFile.summary && (
                    <div style={{ marginBottom: 20, padding: '10px 14px', background: hexToRgba(accent, 0.06), border: `1px solid ${hexToRgba(accent, 0.2)}`, borderRadius: 8, fontSize: 11, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, fontFamily: 'inherit' }}>
                      <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: accent, display: 'block', marginBottom: 4 }}>Summary</span>
                      {selectedFile.summary}
                    </div>
                  )}
                  {selectedFile.content}
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '50%', gap: 12, opacity: 0.4 }}>
                  <div style={{ fontSize: 28 }}>📄</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.5)' }}>Empty file</div>
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          {isEditing && (
            <div style={{ height: 28, borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0 20px', flexShrink: 0 }}>
              <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'rgba(255,255,255,0.2)' }}>
                {editableContent.length} chars · Ctrl+S to save
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════
          RIGHT — Version history (240px)
      ═══════════════════════════════════════ */}
      <div style={{ width: 240, flexShrink: 0, display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.02)' }}>

        {/* Right header */}
        <div style={{ height: 52, flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(8,8,20,0.6)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px' }}>
          <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)' }}>
            Versions
          </span>
          {versions.length > 0 && (
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace' }}>
              {versions.length}
            </span>
          )}
        </div>

        {/* Version list */}
        <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none', padding: '8px 0' }}>
          {versionsLoading ? (
            <div style={{ padding: '20px 16px', textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>Loading…</div>
          ) : versions.length === 0 ? (
            <div style={{ padding: '20px 16px', textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.2)', lineHeight: 1.6 }}>
              No versions yet.<br />Edit and save to create the first version.
            </div>
          ) : (
            versions.map((v, i) => (
              <div
                key={v.id}
                onClick={() => { setEditableContent(v.content); setIsEditing(false) }}
                style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column', gap: 3, transition: 'background 0.1s' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, fontFamily: 'monospace', color: i === 0 ? accent : 'rgba(255,255,255,0.5)' }}>
                    v{versions.length - i}
                  </span>
                  {i === 0 && (
                    <span style={{ fontSize: 8, fontWeight: 800, padding: '1px 5px', borderRadius: 3, background: hexToRgba(accent, 0.12), color: accent, letterSpacing: '0.06em', textTransform: 'uppercase' }}>latest</span>
                  )}
                </div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>
                  {new Date(v.changed_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Sync status + export */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Last synced */}
          {selectedFile?.last_synced_at && (
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', lineHeight: 1.5 }}>
              <Check size={8} style={{ display: 'inline', marginRight: 3 }} />
              Synced {new Date(selectedFile.last_synced_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </div>
          )}

          {/* Export */}
          <button
            onClick={() => {
              if (!selectedFile?.content) return
              downloadFile(
                selectedFile.content,
                fileLabel(selectedFile.file_path),
                'text/markdown',
              )
            }}
            style={{ width: '100%', padding: '7px', background: 'transparent', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 7, cursor: 'pointer', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = accent; e.currentTarget.style.color = accent }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'; e.currentTarget.style.color = 'rgba(255,255,255,0.35)' }}
          >
            Export MD
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════
          Sync confirm modal
      ═══════════════════════════════════════ */}
      {showSyncConfirm && (
        <div
          onClick={() => setShowSyncConfirm(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 480, background: 'rgba(10,10,24,0.98)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: 28, display: 'flex', flexDirection: 'column', gap: 18 }}
          >
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: '#fff', margin: '0 0 6px' }}>Sync from local folder</h2>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: 0, lineHeight: 1.6 }}>
                This reads all Reminisce context files from your local folder and updates Reminisce&apos;s database.
                {pendingChanges.length > 0
                  ? ` ${pendingChanges.length} file${pendingChanges.length !== 1 ? 's have' : ' has'} local changes.`
                  : ' No local changes detected.'}
              </p>
            </div>
            {pendingChanges.length > 0 && (
              <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {pendingChanges.map(c => (
                  <div key={c.filePath} style={{ fontSize: 11, color: '#f59e0b', fontFamily: 'monospace' }}>
                    ↻ {c.filePath.split('/').pop()}
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setShowSyncConfirm(false)}
                style={{ flex: 1, padding: '10px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, background: 'transparent', color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSyncFromLocal}
                disabled={isSyncing}
                style={{ flex: 2, padding: '10px', background: isSyncing ? 'rgba(255,255,255,0.08)' : accent, color: isSyncing ? 'rgba(255,255,255,0.3)' : '#000', border: 'none', borderRadius: 8, fontSize: 11, fontWeight: 800, cursor: isSyncing ? 'not-allowed' : 'pointer' }}
              >
                {isSyncing ? 'Syncing…' : 'Sync from local'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
