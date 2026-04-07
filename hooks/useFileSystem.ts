'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  getStoredHandle,
  openProjectFolder,
  readFile as fsReadFile,
  writeFile as fsWriteFile,
  initProjectStructure as fsInitProjectStructure,
  readGitState as fsReadGitState,
  readAllContextFiles,
  computeFileHash,
  REMINISCE_OWNED_PATHS,
} from '@/lib/fsapi'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GitState {
  branch: string | null
  lastCommit: string | null
  remoteUrl: string | null
}

export interface PendingChange {
  filePath: string        // e.g. 'reminisce/context/architecture.md'
  localContent: string    // what is on disk right now
  dbContent: string       // what is stored in contexts table
  localHash: string       // SHA-256 of localContent
  dbHash: string | null   // file_hash from contexts table (null if never synced)
}

export type SyncStatus = 'idle' | 'syncing' | 'conflict' | 'clean'

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useFileSystem(projectId: string) {
  const [handle, setHandle]           = useState<FileSystemDirectoryHandle | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isSupported, setIsSupported] = useState(true)
  const [folderName, setFolderName]   = useState<string | null>(null)

  // Git state — populated on connect and refreshed on focus
  const [gitState, setGitState]       = useState<GitState>({
    branch: null, lastCommit: null, remoteUrl: null,
  })

  // Sync engine state
  const [syncStatus, setSyncStatus]         = useState<SyncStatus>('idle')
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([])

  // Ref so visibilitychange handler always has the current handle
  const handleRef = useRef<FileSystemDirectoryHandle | null>(null)
  useEffect(() => { handleRef.current = handle }, [handle])

  // ── Initial connection check ────────────────────────────────────────────
  useEffect(() => {
    if (typeof window !== 'undefined' && !('showDirectoryPicker' in window)) {
      setIsSupported(false)
      return
    }
    if (!projectId) return

    const check = async () => {
      try {
        const stored = await getStoredHandle(projectId)
        if (stored) {
          setHandle(stored)
          setIsConnected(true)
          setFolderName(stored.name)
          // Read git state immediately on restore
          const git = await fsReadGitState(stored)
          setGitState(git)
          // Persist branch + last commit to DB (non-fatal)
          persistGitState(git).catch(() => {})
        }
      } catch (err) {
        console.error('useFileSystem: initial handle check failed', err)
      }
    }
    check()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  // ── Focus sync — fires when user returns to this browser tab ────────────
  useEffect(() => {
    const onVisibilityChange = async () => {
      if (document.visibilityState !== 'visible') return
      const h = handleRef.current
      if (!h) return
      // Refresh git state silently
      try {
        const git = await fsReadGitState(h)
        setGitState(git)
        persistGitState(git).catch(() => {})
      } catch { /* non-fatal */ }
      // Run sync check silently — surfaces conflicts without auto-applying
      try {
        await runSyncCheck(h)
      } catch { /* non-fatal */ }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  // ── Persist git state to DB ──────────────────────────────────────────────
  const persistGitState = useCallback(async (git: GitState) => {
    if (!projectId) return
    const updates: Record<string, string | null> = {}
    if (git.branch !== null)     updates.git_branch      = git.branch
    if (git.lastCommit !== null) updates.git_last_commit = git.lastCommit
    if (Object.keys(updates).length === 0) return
    await supabase.from('projects').update(updates).eq('id', projectId)
  }, [projectId])

  // ── Sync check — reads local files, compares hashes to DB ───────────────
  // Returns array of PendingChange (files that differ).
  // Does NOT apply changes — just surfaces them.
  const runSyncCheck = useCallback(async (
    h: FileSystemDirectoryHandle,
  ): Promise<PendingChange[]> => {
    setSyncStatus('syncing')
    try {
      // 1. Read all Reminisce-owned files from local folder
      const localFiles = await readAllContextFiles(h, REMINISCE_OWNED_PATHS)

      // 2. Load current DB state for these files
      const { data: dbRows } = await supabase
        .from('contexts')
        .select('file_path, content, file_hash')
        .eq('project_id', projectId)
        .in('file_path', REMINISCE_OWNED_PATHS as unknown as string[])

      const dbMap = new Map<string, { content: string; hash: string | null }>(
        (dbRows ?? []).map(r => [r.file_path, { content: r.content ?? '', hash: r.file_hash }])
      )

      // 3. Compare hashes
      const changes: PendingChange[] = []
      for (const [path, localContent] of Object.entries(localFiles)) {
        const localHash = await computeFileHash(localContent)
        const db        = dbMap.get(path)
        const dbContent = db?.content ?? ''
        const dbHash    = db?.hash ?? null
        // If local hash differs from stored DB hash → local has changed
        if (localHash !== dbHash) {
          changes.push({ filePath: path, localContent, dbContent, localHash, dbHash })
        }
      }

      setPendingChanges(changes)
      setSyncStatus(changes.length > 0 ? 'conflict' : 'clean')
      return changes
    } catch (err) {
      setSyncStatus('idle')
      console.error('useFileSystem: sync check failed', err)
      return []
    }
  }, [projectId])

  // ── syncFromLocal — applies local→DB for the given file paths ────────────
  // Call this after the user confirms a conflict resolution.
  const syncFromLocal = useCallback(async (
    filePaths?: string[],
  ): Promise<void> => {
    if (!handle) throw new Error('No folder connected')
    setSyncStatus('syncing')
    try {
      const paths = filePaths ?? pendingChanges.map(c => c.filePath)
      const localFiles = await readAllContextFiles(handle, paths as readonly string[])
      const now = new Date().toISOString()

      for (const [path, content] of Object.entries(localFiles)) {
        const hash    = await computeFileHash(content)
        // Extract summary from <!-- REMINISCE:SUMMARY ... --> tag if present
        const summary = extractSummary(content)
        // Upsert into contexts table
        await supabase.from('contexts').upsert(
          {
            project_id:     projectId,
            file_path:      path,
            content,
            file_hash:      hash,
            summary:        summary ?? undefined,
            last_synced_at: now,
            last_modified:  now,
          },
          { onConflict: 'project_id,file_path' },
        )
      }

      setPendingChanges([])
      setSyncStatus('clean')
      toast.success(`Synced ${Object.keys(localFiles).length} file${Object.keys(localFiles).length !== 1 ? 's' : ''} from local folder`)
    } catch (err) {
      setSyncStatus('idle')
      const msg = err instanceof Error ? err.message : String(err)
      toast.error('Sync failed: ' + msg)
      throw err
    }
  }, [handle, pendingChanges, projectId])

  // ── pushToLocal — writes DB content back to local files ──────────────────
  // Used after wizard generation to inject new blueprint files.
  const pushToLocal = useCallback(async (
    files: Record<string, string>,
  ): Promise<number> => {
    if (!handle) throw new Error('No folder connected')
    let written = 0
    const now = new Date().toISOString()
    for (const [path, content] of Object.entries(files)) {
      try {
        await fsWriteFile(handle, path, content)
        const hash = await computeFileHash(content)
        // Update last_synced_at in DB to mark this as in sync
        await supabase
          .from('contexts')
          .update({ file_hash: hash, last_synced_at: now })
          .eq('project_id', projectId)
          .eq('file_path', path)
        written++
      } catch (err) {
        console.error(`pushToLocal: failed to write ${path}`, err)
        // Non-fatal — continue with other files
      }
    }
    if (written > 0) {
      setSyncStatus('clean')
      setPendingChanges([])
    }
    return written
  }, [handle, projectId])

  // ── readGitState — manual refresh ────────────────────────────────────────
  const readGitState = useCallback(async (): Promise<GitState> => {
    if (!handle) return { branch: null, lastCommit: null, remoteUrl: null }
    const git = await fsReadGitState(handle)
    setGitState(git)
    persistGitState(git).catch(() => {})
    return git
  }, [handle, persistGitState])

  // ── openFolder ───────────────────────────────────────────────────────────
  const openFolder = useCallback(async (): Promise<FileSystemDirectoryHandle | null> => {
    try {
      const newHandle = await openProjectFolder(projectId)
      setHandle(newHandle)
      setIsConnected(true)
      setFolderName(newHandle.name)
      toast.success(`Folder "${newHandle.name}" connected`)
      // Read git state immediately
      const git = await fsReadGitState(newHandle)
      setGitState(git)
      persistGitState(git).catch(() => {})
      // Run initial sync check
      await runSyncCheck(newHandle)
      return newHandle
    } catch (err) {
      console.error('useFileSystem: openFolder failed', err)
      toast.error('Failed to connect project folder. You may have dismissed the prompt.')
      return null
    }
  }, [projectId, persistGitState, runSyncCheck])

  // ── Simple wrappers (unchanged API for existing consumers) ───────────────
  const readFile = useCallback(async (path: string): Promise<string> => {
    if (!handle) throw new Error('No folder connected')
    return fsReadFile(handle, path)
  }, [handle])

  const writeFile = useCallback(async (path: string, content: string): Promise<void> => {
    if (!handle) throw new Error('No folder connected')
    return fsWriteFile(handle, path, content)
  }, [handle])

  const initProject = useCallback(async (): Promise<void> => {
    if (!handle) throw new Error('No folder connected')
    try {
      await fsInitProjectStructure(handle)
      toast.success('Project structure initialised in folder')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(err)
      toast.error('Failed to initialise structure: ' + msg)
    }
  }, [handle])

  return {
    // ── Existing API (unchanged — no consumer changes needed) ──
    handle,
    isConnected,
    isSupported,
    folderName,
    openFolder,
    readFile,
    writeFile,
    initProject,
    // ── New additions ──────────────────────────────────────────
    gitState,         // { branch, lastCommit, remoteUrl }
    syncStatus,       // 'idle' | 'syncing' | 'conflict' | 'clean'
    pendingChanges,   // PendingChange[] — files that differ local vs DB
    readGitState,     // () => Promise<GitState> — manual refresh
    syncFromLocal,    // (paths?) => Promise<void> — apply local→DB
    pushToLocal,      // (files) => Promise<number> — write DB→local
  }
}

// ─── Internal helpers ────────────────────────────────────────────────────────

// Extracts the summary paragraph from a <!-- REMINISCE:SUMMARY ... --> tag.
// Returns null if the tag is not present.
function extractSummary(content: string): string | null {
  const match = content.match(
    /<!--\s*REMINISCE:SUMMARY\s*([\s\S]*?)\s*-->/i,
  )
  if (!match) return null
  // Strip the OWNED_BY / LAST_UPDATED metadata lines — keep only prose
  const lines = match[1]
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0 && !l.startsWith('OWNED_BY') && !l.startsWith('LAST_UPDATED') && !l.startsWith('VERSION'))
  return lines.join(' ').trim() || null
}
