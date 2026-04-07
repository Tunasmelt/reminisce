import { get, set } from 'idb-keyval'

// ─────────────────────────────────────────────────────────────────────────────
//  Handle storage — per-project folder handle persisted in IndexedDB
// ─────────────────────────────────────────────────────────────────────────────

export function getHandleKey(projectId: string): string {
  return `reminisce_folder_${projectId}`
}

export async function openProjectFolder(
  projectId: string,
): Promise<FileSystemDirectoryHandle> {
  const handle = await window.showDirectoryPicker({ mode: 'readwrite' })
  await set(getHandleKey(projectId), handle)
  return handle
}

export async function saveHandle(
  projectId: string,
  handle: FileSystemDirectoryHandle,
): Promise<void> {
  await set(getHandleKey(projectId), handle)
}

export async function getStoredHandle(
  projectId: string,
): Promise<FileSystemDirectoryHandle | null> {
  try {
    const handle = await get<FileSystemDirectoryHandle>(getHandleKey(projectId))
    if (!handle) return null
    const opts: FileSystemHandlePermissionDescriptor = { mode: 'readwrite' }
    const perm = await handle.queryPermission(opts)
    if (perm === 'granted') return handle
    const req = await handle.requestPermission(opts)
    return req === 'granted' ? handle : null
  } catch (err) {
    console.error('Error getting stored handle', err)
    return null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Directory traversal helpers
// ─────────────────────────────────────────────────────────────────────────────

async function getDirHandle(
  base: FileSystemDirectoryHandle,
  path: string,
  create = false,
): Promise<FileSystemDirectoryHandle> {
  const parts = path.split('/').filter(Boolean)
  let cur = base
  for (const part of parts) {
    cur = await cur.getDirectoryHandle(part, { create })
  }
  return cur
}

// ─────────────────────────────────────────────────────────────────────────────
//  File read / write
// ─────────────────────────────────────────────────────────────────────────────

export async function readFile(
  handle: FileSystemDirectoryHandle,
  path: string,
): Promise<string> {
  const slash = path.lastIndexOf('/')
  const dirHandle = slash === -1
    ? handle
    : await getDirHandle(handle, path.slice(0, slash), false)
  const name = slash === -1 ? path : path.slice(slash + 1)
  const fh = await dirHandle.getFileHandle(name, { create: false })
  return await (await fh.getFile()).text()
}

export async function writeFile(
  handle: FileSystemDirectoryHandle,
  path: string,
  content: string,
): Promise<void> {
  const slash = path.lastIndexOf('/')
  const dirHandle = slash === -1
    ? handle
    : await getDirHandle(handle, path.slice(0, slash), true)
  const name = slash === -1 ? path : path.slice(slash + 1)
  const fh = await dirHandle.getFileHandle(name, { create: true })
  const writable = await fh.createWritable()
  await writable.write(content)
  await writable.close()
}

// ─────────────────────────────────────────────────────────────────────────────
//  Git state reading — reads plain-text files from .git/ directory.
//  Works for any git provider (GitHub, GitLab, Bitbucket, self-hosted).
//  No API calls, no auth, no rate limits. Works offline.
// ─────────────────────────────────────────────────────────────────────────────

export async function readGitBranch(
  handle: FileSystemDirectoryHandle,
): Promise<string | null> {
  try {
    // .git/HEAD contains either:
    //   "ref: refs/heads/main\n"  (normal branch)
    //   "<sha>\n"                  (detached HEAD)
    const raw = await readFile(handle, '.git/HEAD')
    const trimmed = raw.trim()
    if (trimmed.startsWith('ref: refs/heads/')) {
      return trimmed.replace('ref: refs/heads/', '')
    }
    // Detached HEAD — return short SHA
    return trimmed.slice(0, 8) + ' (detached)'
  } catch {
    return null
  }
}

export async function readGitLastCommit(
  handle: FileSystemDirectoryHandle,
): Promise<string | null> {
  try {
    // .git/COMMIT_EDITMSG contains the last commit message.
    // Take the first non-empty, non-comment line only.
    const raw = await readFile(handle, '.git/COMMIT_EDITMSG')
    const line = raw
      .split('\n')
      .map(l => l.trim())
      .find(l => l.length > 0 && !l.startsWith('#'))
    return line ?? null
  } catch {
    return null
  }
}

export async function readGitLastSyncedCommit(
  handle: FileSystemDirectoryHandle,
): Promise<string | null> {
  try {
    // .reminisce/sync contains the SHA of the last commit synced to Supabase.
    const raw = await readFile(handle, '.reminisce/sync')
    return raw.trim()
  } catch {
    return null
  }
}

export async function readGitRemoteUrl(
  handle: FileSystemDirectoryHandle,
): Promise<string | null> {
  try {
    // .git/config contains [remote "origin"] url = https://...
    const raw = await readFile(handle, '.git/config')
    const lines = raw.split('\n')
    let inOrigin = false
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed === '[remote "origin"]') { inOrigin = true; continue }
      if (inOrigin && trimmed.startsWith('[')) break // next section
      if (inOrigin && trimmed.startsWith('url =')) {
        return trimmed.replace('url =', '').trim()
      }
    }
    return null
  } catch {
    return null
  }
}

// Reads all three git values in a single parallel call.
export async function readGitState(
  handle: FileSystemDirectoryHandle,
): Promise<{ branch: string | null; lastCommit: string | null; remoteUrl: string | null }> {
  const [branch, lastCommit, remoteUrl] = await Promise.all([
    readGitBranch(handle),
    readGitLastCommit(handle),
    readGitRemoteUrl(handle),
  ])
  return { branch, lastCommit, remoteUrl }
}

// ─────────────────────────────────────────────────────────────────────────────
//  File hash — SHA-256 of content string.
//  Used by the sync engine to detect whether a local file differs
//  from the version stored in the contexts table.
// ─────────────────────────────────────────────────────────────────────────────

export async function computeFileHash(content: string): Promise<string> {
  const encoded = new TextEncoder().encode(content)
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded)
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

// ─────────────────────────────────────────────────────────────────────────────
//  Bulk context file reader — reads every file inside reminisce/
//  Returns a map of file_path → content for all files that exist.
//  Non-existent or unreadable files are silently skipped.
// ─────────────────────────────────────────────────────────────────────────────

// All paths Reminisce owns and may want to sync.
// Logs are excluded — they are developer-owned and never read back.
export const REMINISCE_OWNED_PATHS = [
  'reminisce/context/architecture.md',
  'reminisce/context/tech-stack.md',
  'reminisce/context/coding-guidelines.md',
  'reminisce/context/product-scope.md',
  'reminisce/workflow/phases.md',
  'reminisce/workflow/features.md',
  'reminisce/prompts/master-prompt.md',
] as const

export const DEVELOPER_OWNED_PATHS = [
  'reminisce/logs/agent-runs.md',
  'reminisce/logs/changes.md',
] as const

export async function readAllContextFiles(
  handle: FileSystemDirectoryHandle,
  paths: readonly string[] = REMINISCE_OWNED_PATHS,
): Promise<Record<string, string>> {
  const results: Record<string, string> = {}
  await Promise.allSettled(
    paths.map(async (path) => {
      try {
        const content = await readFile(handle, path)
        if (content.trim().length > 0) results[path] = content
      } catch {
        // File doesn't exist yet — skip silently
      }
    }),
  )
  return results
}

// ─────────────────────────────────────────────────────────────────────────────
//  Project structure initialisation
//  Creates the reminisce/ folder layout without overwriting existing files.
//  Called once when user first connects a folder, or manually from settings.
//  Only creates directories and empty placeholder files.
//  Actual content is written by the wizard generate route via writeFile.
// ─────────────────────────────────────────────────────────────────────────────

// Directories to create (no placeholder files — content comes from wizard)
const REMINISCE_DIRS = [
  'reminisce/context',
  'reminisce/workflow',
  'reminisce/prompts/features',
  'reminisce/logs',
  'reminisce/editor',
] as const

// Log files get placeholder text because they are developer-owned
// and accumulate over time — they should exist from day one.
const LOG_PLACEHOLDERS: Record<string, string> = {
  'reminisce/logs/agent-runs.md':
    '# Agent Runs Log\n\nThis file is automatically appended by Reminisce after each agent run.\nDo not delete — it is your project\'s AI activity history.\n',
  'reminisce/logs/changes.md':
    '# Project Changes Log\n\nThis file is automatically appended by Reminisce when PAM makes project changes.\nDo not delete — it is your project\'s decision history.\n',
}

export async function initProjectStructure(
  handle: FileSystemDirectoryHandle,
): Promise<void> {
  // 1. Create all required directories
  for (const dir of REMINISCE_DIRS) {
    await getDirHandle(handle, dir, true)
  }

  // 2. Create log placeholder files only if they don't already exist
  for (const [path, placeholder] of Object.entries(LOG_PLACEHOLDERS)) {
    try {
      await readFile(handle, path)
      // File exists — leave it alone
    } catch {
      // Doesn't exist — create with placeholder
      await writeFile(handle, path, placeholder)
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Directory scanner — returns a FileTree for the reminisce/ folder.
//  Used by the context page file tree panel.
// ─────────────────────────────────────────────────────────────────────────────

export type FileTree = {
  name: string
  kind: 'file' | 'directory'
  path: string
  children?: FileTree[]
}

export async function scanDirectory(
  handle: FileSystemDirectoryHandle,
  path = '',
): Promise<FileTree[]> {
  const tree: FileTree[] = []
  for await (const entry of handle.values()) {
    const entryPath = path ? `${path}/${entry.name}` : entry.name
    if (entry.kind === 'directory') {
      tree.push({
        name: entry.name,
        kind: 'directory',
        path: entryPath,
        children: await scanDirectory(entry, entryPath),
      })
    } else {
      tree.push({ name: entry.name, kind: 'file', path: entryPath })
    }
  }
  return tree.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}
