'use client'

import { useState, useEffect } from 'react'
import { 
  getStoredHandle, 
  openProjectFolder, 
  readFile as fsReadFile, 
  writeFile as fsWriteFile, 
  initProjectStructure as fsInitProjectStructure 
} from '@/lib/fsapi'
import { toast } from 'sonner'

export function useFileSystem() {
  const [handle, setHandle] = useState<FileSystemDirectoryHandle | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isSupported, setIsSupported] = useState(true)

  useEffect(() => {
    // Check if the File System Access API is supported
    if (typeof window !== 'undefined' && !('showDirectoryPicker' in window)) {
      setIsSupported(false)
      return
    }

    const checkStoredHandle = async () => {
      try {
        const storedHandle = await getStoredHandle()
        if (storedHandle) {
          setHandle(storedHandle)
          setIsConnected(true)
        }
      } catch (err) {
        console.error('Error during initial handle check', err)
      }
    }
    checkStoredHandle()
  }, [])

  const openFolder = async () => {
    try {
      const newHandle = await openProjectFolder()
      setHandle(newHandle)
      setIsConnected(true)
      toast.success('Project folder connected successfully')
      return newHandle
    } catch (error) {
      console.error('Failed to open folder:', error)
      toast.error('Failed to connect project folder. You may have dismissed the prompt.')
      return null
    }
  }

  const readFile = async (path: string) => {
    if (!handle) throw new Error('No folder connected')
    return await fsReadFile(handle, path)
  }

  const writeFile = async (path: string, content: string) => {
    if (!handle) throw new Error('No folder connected')
    return await fsWriteFile(handle, path, content)
  }

  const initProject = async () => {
    if (!handle) throw new Error('No folder connected')
    try {
      await fsInitProjectStructure(handle)
      toast.success('Reminisce project structure initialized')
    } catch (err: any) {
      console.error(err)
      toast.error('Failed to initialize structure: ' + err.message)
    }
  }

  return {
    handle,
    isConnected,
    isSupported,
    openFolder,
    readFile,
    writeFile,
    initProject
  }
}
