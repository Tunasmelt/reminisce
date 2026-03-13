import { get, set } from 'idb-keyval';

const HANDLE_KEY = 'reminisce_project_handle';

export async function openProjectFolder(): Promise<FileSystemDirectoryHandle> {
  const handle = await window.showDirectoryPicker({
    mode: 'readwrite',
  });
  await set(HANDLE_KEY, handle);
  return handle;
}

export async function getStoredHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const handle = await get<FileSystemDirectoryHandle>(HANDLE_KEY);
    if (!handle) return null;

    // Check if we already have permission
    const options: FileSystemHandlePermissionDescriptor = { mode: 'readwrite' };
    const permission = await handle.queryPermission(options);
    
    if (permission === 'granted') {
      return handle;
    }
    
    // Request permission if not granted
    const request = await handle.requestPermission(options);
    if (request === 'granted') {
      return handle;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting stored handle:', error);
    return null;
  }
}

// Helper to traverse to a directory, optionally creating missing directories
async function getDirectoryHandleFromPath(baseHandle: FileSystemDirectoryHandle, path: string, create: boolean = false): Promise<FileSystemDirectoryHandle> {
  const parts = path.split('/').filter(p => p.length > 0);
  let currentHandle = baseHandle;
  
  for (const part of parts) {
    currentHandle = await currentHandle.getDirectoryHandle(part, { create });
  }
  
  return currentHandle;
}

export async function readFile(handle: FileSystemDirectoryHandle, path: string): Promise<string> {
  const lastSlashIndex = path.lastIndexOf('/');
  let dirHandle = handle;
  let filename = path;
  
  if (lastSlashIndex !== -1) {
    const dirPath = path.substring(0, lastSlashIndex);
    filename = path.substring(lastSlashIndex + 1);
    dirHandle = await getDirectoryHandleFromPath(handle, dirPath, false);
  }
  
  const fileHandle = await dirHandle.getFileHandle(filename, { create: false });
  const file = await fileHandle.getFile();
  return await file.text();
}

export async function writeFile(handle: FileSystemDirectoryHandle, path: string, content: string): Promise<void> {
  const lastSlashIndex = path.lastIndexOf('/');
  let dirHandle = handle;
  let filename = path;
  
  if (lastSlashIndex !== -1) {
    const dirPath = path.substring(0, lastSlashIndex);
    filename = path.substring(lastSlashIndex + 1);
    dirHandle = await getDirectoryHandleFromPath(handle, dirPath, true);
  }
  
  const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
  // createWritable is part of the File System Access API
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
}

const DEFAULT_FILES: Record<string, string[]> = {
  'reminisce/context': [
    'architecture.md',
    'tech-stack.md',
    'api-design.md',
    'database-schema.md',
    'coding-guidelines.md',
    'ai-governance.md',
    'product-scope.md'
  ],
  'reminisce/workflow': [
    'phases.md',
    'feature-roadmap.md',
    'development-workflow.md'
  ],
  'reminisce/features': [],
  'reminisce/prompts': [],
  'reminisce/logs': [
    'development-log.md',
    'architecture-changes.md',
    'agent-runs.md'
  ]
};

export async function initProjectStructure(handle: FileSystemDirectoryHandle): Promise<void> {
  for (const [dirPath, files] of Object.entries(DEFAULT_FILES)) {
    // Create directory
    const dirHandle = await getDirectoryHandleFromPath(handle, dirPath, true);
    
    // Create empty files (or keep existing)
    for (const file of files) {
      try {
        await dirHandle.getFileHandle(file, { create: false });
      } catch {
        // Doesn't exist, create it
        const fileHandle = await dirHandle.getFileHandle(file, { create: true });
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
        const writable = await fileHandle.createWritable();
        await writable.write('');
        await writable.close();
      }
    }
  }
}
export type FileTree = {
  name: string;
  kind: 'file' | 'directory';
  path: string;
  children?: FileTree[];
}

export async function scanDirectory(handle: FileSystemDirectoryHandle, path: string = ''): Promise<FileTree[]> {
  const tree: FileTree[] = [];
  
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  for await (const entry of handle.values()) {
    const entryPath = path ? `${path}/${entry.name}` : entry.name;
    
    if (entry.kind === 'directory') {
      tree.push({
        name: entry.name,
        kind: 'directory',
        path: entryPath,
        children: await scanDirectory(entry, entryPath)
      });
    } else {
      tree.push({
        name: entry.name,
        kind: 'file',
        path: entryPath
      });
    }
  }
  
  return tree.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}
