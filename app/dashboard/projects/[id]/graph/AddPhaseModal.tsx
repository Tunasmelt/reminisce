'use client'

import { useState, useEffect, useRef } from 'react'
import { useTheme } from '@/hooks/useTheme'
import { X, Layers } from 'lucide-react'

// ─────────────────────────────────────────────────────────
//  AddPhaseModal
//
//  Glass modal for creating a new phase.
//  Called from: graph page floating action bar.
//  On confirm: calls createPhase from useProjectData,
//              then closes. Parent handles optimistic update.
//
//  Props:
//    onClose    — close without saving
//    onConfirm  — (name, description) => Promise<void>
//    saving     — show loading state on confirm button
// ─────────────────────────────────────────────────────────

interface AddPhaseModalProps {
  onClose: () => void
  onConfirm: (name: string, description: string) => Promise<void>
  saving?: boolean
}

function hexToRgba(hex: string, a: number) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

export function AddPhaseModal({
  onClose,
  onConfirm,
  saving = false,
}: AddPhaseModalProps) {
  const { accent } = useTheme()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [nameError, setNameError] = useState('')
  const nameRef = useRef<HTMLInputElement>(null)

  // Auto-focus name input on open
  useEffect(() => {
    nameRef.current?.focus()
  }, [])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handleSubmit = async () => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      setNameError('Phase name is required')
      nameRef.current?.focus()
      return
    }
    setNameError('')
    await onConfirm(trimmedName, description.trim())
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    // Backdrop
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
        padding: 24,
      }}
    >
      {/* Modal panel */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 480,
          background: 'rgba(10,10,24,0.98)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 20,
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
            background: 'rgba(255,255,255,0.02)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 9,
                background: 'rgba(59,130,246,0.12)',
                border: '1px solid rgba(59,130,246,0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Layers size={15} color="#60a5fa" />
            </div>
            <div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#fff',
                  lineHeight: 1.2,
                }}
              >
                New Phase
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.35)',
                  marginTop: 1,
                }}
              >
                Add a lifecycle phase to your project
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.09)',
              color: 'rgba(255,255,255,0.4)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s',
              flexShrink: 0,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.1)'
              e.currentTarget.style.color = '#fff'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
              e.currentTarget.style.color = 'rgba(255,255,255,0.4)'
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px' }}>
          {/* Name field */}
          <div style={{ marginBottom: 18 }}>
            <label
              style={{
                display: 'block',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.4)',
                marginBottom: 8,
              }}
            >
              Phase Name <span style={{ color: '#f87171' }}>*</span>
            </label>
            <input
              ref={nameRef}
              value={name}
              onChange={e => {
                setName(e.target.value)
                if (nameError) setNameError('')
              }}
              onKeyDown={handleKeyDown}
              placeholder="e.g. API Integration & Testing"
              maxLength={80}
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.05)',
                backdropFilter: 'blur(8px)',
                border: `1px solid ${
                  nameError
                    ? 'rgba(248,113,113,0.5)'
                    : 'rgba(255,255,255,0.1)'
                }`,
                borderRadius: 10,
                padding: '11px 14px',
                fontSize: 13,
                color: '#fff',
                outline: 'none',
                transition: 'border-color 0.15s',
                boxSizing: 'border-box',
              }}
              onFocus={e => {
                if (!nameError) {
                  e.currentTarget.style.borderColor =
                    'rgba(59,130,246,0.4)'
                }
              }}
              onBlur={e => {
                if (!nameError) {
                  e.currentTarget.style.borderColor =
                    'rgba(255,255,255,0.1)'
                }
              }}
            />
            {nameError && (
              <div
                style={{
                  fontSize: 11,
                  color: '#f87171',
                  marginTop: 5,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                {nameError}
              </div>
            )}
          </div>

          {/* Description field */}
          <div style={{ marginBottom: 24 }}>
            <label
              style={{
                display: 'block',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.4)',
                marginBottom: 8,
              }}
            >
              Description{' '}
              <span style={{ color: 'rgba(255,255,255,0.2)', fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>
                (optional)
              </span>
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What will be built or achieved in this phase?"
              rows={3}
              maxLength={300}
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.05)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10,
                padding: '11px 14px',
                fontSize: 13,
                color: '#fff',
                outline: 'none',
                resize: 'none',
                lineHeight: 1.6,
                transition: 'border-color 0.15s',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
              }}
              onFocus={e => {
                e.currentTarget.style.borderColor =
                  'rgba(59,130,246,0.4)'
              }}
              onBlur={e => {
                e.currentTarget.style.borderColor =
                  'rgba(255,255,255,0.1)'
              }}
            />
            <div
              style={{
                fontSize: 10,
                color: 'rgba(255,255,255,0.18)',
                textAlign: 'right',
                marginTop: 4,
              }}
            >
              {description.length}/300
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={onClose}
              disabled={saving}
              style={{
                flex: 1,
                padding: '11px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.09)',
                borderRadius: 10,
                color: 'rgba(255,255,255,0.5)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background =
                  'rgba(255,255,255,0.08)'
                e.currentTarget.style.color = '#fff'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background =
                  'rgba(255,255,255,0.04)'
                e.currentTarget.style.color =
                  'rgba(255,255,255,0.5)'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving || !name.trim()}
              style={{
                flex: 2,
                padding: '11px',
                background:
                  saving || !name.trim()
                    ? 'rgba(255,255,255,0.06)'
                    : hexToRgba(accent, 1),
                border: 'none',
                borderRadius: 10,
                color:
                  saving || !name.trim()
                    ? 'rgba(255,255,255,0.25)'
                    : '#000',
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: '0.05em',
                cursor:
                  saving || !name.trim()
                    ? 'not-allowed'
                    : 'pointer',
                transition: 'all 0.15s',
                boxShadow:
                  !saving && name.trim()
                    ? `0 0 20px ${hexToRgba(accent, 0.3)}`
                    : 'none',
              }}
            >
              {saving ? 'Creating...' : 'Create Phase'}
            </button>
          </div>

          {/* Keyboard hint */}
          <div
            style={{
              marginTop: 12,
              textAlign: 'center',
              fontSize: 10,
              color: 'rgba(255,255,255,0.15)',
            }}
          >
            Press Enter to confirm · Esc to cancel
          </div>
        </div>
      </div>
    </div>
  )
}
