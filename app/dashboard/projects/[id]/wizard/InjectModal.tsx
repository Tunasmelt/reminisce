'use client'

import { useState } from 'react'
import { X, FolderOpen, Check, FileText } from 'lucide-react'

function hexToRgba(hex: string, a: number) {
  if (!hex || hex.length < 7) return `rgba(245,158,11,${a})`
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

export interface InjectModalProps {
  files: Record<string, string>
  folderName: string | null
  isConnected: boolean
  onConnect: () => void
  onConfirm: () => Promise<void>
  onClose: () => void
  accent: string
}

export function InjectModal({
  files, folderName, isConnected, onConnect, onConfirm, onClose, accent,
}: InjectModalProps) {
  const [writing, setWriting] = useState(false)
  const [done,    setDone]    = useState(false)
  const [written, setWritten] = useState<string[]>([])
  const entries = Object.entries(files)

  const handleWrite = async () => {
    setWriting(true)
    await onConfirm()
    setWritten(entries.map(([p]) => p))
    setDone(true)
    setWriting(false)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
      backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
      zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        background: 'rgba(12,12,28,0.98)', border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 20, padding: '28px 32px', maxWidth: 520, width: '100%',
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)', maxHeight: '80vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>
            {done ? '✅ Files written' : 'Inject blueprint to local folder'}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)' }}>
            <X size={16} />
          </button>
        </div>

        {!isConnected && !done ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 16, lineHeight: 1.6 }}>
              Connect a local folder to write the blueprint files directly to your project directory.
            </div>
            <button onClick={onConnect} style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '10px 20px', background: hexToRgba(accent, 0.1),
              border: `1px solid ${hexToRgba(accent, 0.3)}`,
              borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 700, color: accent,
            }}>
              <FolderOpen size={14} /> Connect folder
            </button>
          </div>
        ) : (
          <>
            {folderName && (
              <div style={{
                fontSize: 11, color: accent, fontFamily: 'monospace',
                background: hexToRgba(accent, 0.08), border: `1px solid ${hexToRgba(accent, 0.2)}`,
                borderRadius: 8, padding: '6px 12px', marginBottom: 16,
              }}>
                📁 /{folderName}
              </div>
            )}
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 10 }}>
              {entries.length} files to write:
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 260, overflowY: 'auto', marginBottom: 20 }}>
              {entries.map(([path, content]) => {
                const isWritten = written.includes(path)
                const sizeKb    = (new TextEncoder().encode(content).length / 1024).toFixed(1)
                return (
                  <div key={path} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8,
                    background: isWritten ? 'rgba(16,185,129,0.05)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${isWritten ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.05)'}`,
                  }}>
                    {isWritten
                      ? <Check size={11} color="#10b981" />
                      : <FileText size={11} color="rgba(255,255,255,0.3)" />
                    }
                    <span style={{
                      flex: 1, fontSize: 11, fontFamily: 'monospace',
                      color: isWritten ? '#10b981' : 'rgba(255,255,255,0.6)',
                    }}>{path}</span>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>{sizeKb}kb</span>
                  </div>
                )
              })}
            </div>
            {done ? (
              <div style={{ textAlign: 'center', fontSize: 13, color: '#10b981', fontWeight: 600 }}>
                All {written.length} files written successfully.
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={onClose} style={{
                  padding: '9px 18px', background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10,
                  cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)',
                }}>Cancel</button>
                <button onClick={handleWrite} disabled={writing} style={{
                  padding: '9px 20px', background: accent, border: 'none', borderRadius: 10,
                  cursor: writing ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 800, color: '#000',
                  opacity: writing ? 0.6 : 1, transition: 'opacity 0.15s',
                  boxShadow: `0 0 20px ${hexToRgba(accent, 0.4)}`,
                }}>
                  {writing ? 'Writing...' : 'Write files →'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
