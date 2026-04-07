'use client'

import { useState, useEffect, useRef } from 'react'
import { useTheme } from '@/hooks/useTheme'
import { X, Box } from 'lucide-react'
import type { Phase, FeatureType } from './types'
import { FEATURE_TYPE_CONFIG } from './types'

// ─────────────────────────────────────────────────────────
//  AddFeatureModal
//
//  Glass modal for creating a new feature.
//  Called from: graph page floating action bar, board page.
//  On confirm: calls createFeature from useProjectData,
//              then closes. Parent handles optimistic update.
//
//  Props:
//    phases         — list of phases to pick from
//    defaultPhaseId — pre-select a phase (e.g. from board column)
//    onClose        — close without saving
//    onConfirm      — (input) => Promise<void>
//    saving         — show loading state on confirm button
// ─────────────────────────────────────────────────────────

interface AddFeatureInput {
  name: string
  description: string
  type: FeatureType
  phaseId: string
}

interface AddFeatureModalProps {
  phases: Phase[]
  defaultPhaseId?: string
  onClose: () => void
  onConfirm: (input: AddFeatureInput) => Promise<void>
  saving?: boolean
}

function hexToRgba(hex: string, a: number) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

const FEATURE_TYPES: FeatureType[] = [
  'frontend',
  'backend',
  'database',
  'testing',
  'architecture',
]

export function AddFeatureModal({
  phases,
  defaultPhaseId,
  onClose,
  onConfirm,
  saving = false,
}: AddFeatureModalProps) {
  const { accent } = useTheme()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<FeatureType>('frontend')
  const [phaseId, setPhaseId] = useState(
    defaultPhaseId ?? phases[0]?.id ?? ''
  )
  const [nameError, setNameError] = useState('')
  const [phaseError, setPhaseError] = useState('')
  const nameRef = useRef<HTMLInputElement>(null)

  // Auto-focus name on open
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

  // Update phaseId if defaultPhaseId changes
  useEffect(() => {
    if (defaultPhaseId) setPhaseId(defaultPhaseId)
  }, [defaultPhaseId])

  const handleSubmit = async () => {
    let valid = true

    const trimmedName = name.trim()
    if (!trimmedName) {
      setNameError('Feature name is required')
      nameRef.current?.focus()
      valid = false
    } else {
      setNameError('')
    }

    if (!phaseId) {
      setPhaseError('Please select a phase')
      valid = false
    } else {
      setPhaseError('')
    }

    if (!valid) return

    await onConfirm({
      name: trimmedName,
      description: description.trim(),
      type,
      phaseId,
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const selectedTypeCfg = FEATURE_TYPE_CONFIG[type] ?? {
    label: type,
    color: 'rgba(255,255,255,0.4)',
  }

  const canSubmit = name.trim().length > 0 && phaseId.length > 0

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
          maxWidth: 520,
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
                background: 'rgba(139,92,246,0.12)',
                border: '1px solid rgba(139,92,246,0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Box size={15} color="#a78bfa" />
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
                New Feature
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.35)',
                  marginTop: 1,
                }}
              >
                Add a feature module to a phase
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
          <div style={{ marginBottom: 16 }}>
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
              Feature Name <span style={{ color: '#f87171' }}>*</span>
            </label>
            <input
              ref={nameRef}
              value={name}
              onChange={e => {
                setName(e.target.value)
                if (nameError) setNameError('')
              }}
              onKeyDown={handleKeyDown}
              placeholder="e.g. OAuth2 login flow"
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
                if (!nameError)
                  e.currentTarget.style.borderColor =
                    'rgba(139,92,246,0.4)'
              }}
              onBlur={e => {
                if (!nameError)
                  e.currentTarget.style.borderColor =
                    'rgba(255,255,255,0.1)'
              }}
            />
            {nameError && (
              <div
                style={{
                  fontSize: 11,
                  color: '#f87171',
                  marginTop: 5,
                }}
              >
                {nameError}
              </div>
            )}
          </div>

          {/* Phase + Type row */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 12,
              marginBottom: 16,
            }}
          >
            {/* Phase picker */}
            <div>
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
                Phase <span style={{ color: '#f87171' }}>*</span>
              </label>
              <select
                value={phaseId}
                onChange={e => {
                  setPhaseId(e.target.value)
                  if (phaseError) setPhaseError('')
                }}
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.05)',
                  border: `1px solid ${
                    phaseError
                      ? 'rgba(248,113,113,0.5)'
                      : 'rgba(255,255,255,0.1)'
                  }`,
                  borderRadius: 10,
                  padding: '11px 14px',
                  fontSize: 12,
                  color: phaseId ? '#fff' : 'rgba(255,255,255,0.3)',
                  outline: 'none',
                  cursor: 'pointer',
                  appearance: 'none',
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.3)' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 12px center',
                  paddingRight: 32,
                  boxSizing: 'border-box',
                }}
              >
                {phases.length === 0 ? (
                  <option value="" style={{ background: '#0a0a18' }}>
                    No phases — create one first
                  </option>
                ) : (
                  <>
                    <option
                      value=""
                      disabled
                      style={{ background: '#0a0a18' }}
                    >
                      Select a phase...
                    </option>
                    {phases.map(p => (
                      <option
                        key={p.id}
                        value={p.id}
                        style={{ background: '#0a0a18' }}
                      >
                        {p.name}
                      </option>
                    ))}
                  </>
                )}
              </select>
              {phaseError && (
                <div
                  style={{
                    fontSize: 11,
                    color: '#f87171',
                    marginTop: 5,
                  }}
                >
                  {phaseError}
                </div>
              )}
            </div>

            {/* Type picker */}
            <div>
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
                Type
              </label>
              <select
                value={type}
                onChange={e => setType(e.target.value as FeatureType)}
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 10,
                  padding: '11px 14px',
                  fontSize: 12,
                  color: '#fff',
                  outline: 'none',
                  cursor: 'pointer',
                  appearance: 'none',
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.3)' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 12px center',
                  paddingRight: 32,
                  boxSizing: 'border-box',
                }}
              >
                {FEATURE_TYPES.map(t => (
                  <option
                    key={t}
                    value={t}
                    style={{ background: '#0a0a18' }}
                  >
                    {FEATURE_TYPE_CONFIG[t]?.label ?? t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Selected type preview */}
          <div
            style={{
              marginBottom: 16,
              padding: '8px 12px',
              borderRadius: 8,
              background: `${selectedTypeCfg.color}10`,
              border: `1px solid ${selectedTypeCfg.color}25`,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 11,
              color: selectedTypeCfg.color,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: selectedTypeCfg.color,
                flexShrink: 0,
              }}
            />
            <span style={{ fontWeight: 600 }}>
              {selectedTypeCfg.label}
            </span>
            <span style={{ color: 'rgba(255,255,255,0.25)', fontWeight: 400 }}>
              — will be placed under the selected phase
            </span>
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
              <span
                style={{
                  color: 'rgba(255,255,255,0.2)',
                  fontWeight: 500,
                  textTransform: 'none',
                  letterSpacing: 0,
                }}
              >
                (optional)
              </span>
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What does this feature do?"
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
                  'rgba(139,92,246,0.4)'
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

          {/* No phases warning */}
          {phases.length === 0 && (
            <div
              style={{
                marginBottom: 16,
                padding: '10px 14px',
                borderRadius: 10,
                background: 'rgba(248,113,113,0.06)',
                border: '1px solid rgba(248,113,113,0.2)',
                fontSize: 12,
                color: 'rgba(248,113,113,0.8)',
                lineHeight: 1.5,
              }}
            >
              You need at least one phase before adding features.
              Create a phase first using the + Add Phase button.
            </div>
          )}

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
              disabled={saving || !canSubmit || phases.length === 0}
              style={{
                flex: 2,
                padding: '11px',
                background:
                  saving || !canSubmit || phases.length === 0
                    ? 'rgba(255,255,255,0.06)'
                    : hexToRgba(accent, 1),
                border: 'none',
                borderRadius: 10,
                color:
                  saving || !canSubmit || phases.length === 0
                    ? 'rgba(255,255,255,0.25)'
                    : '#000',
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: '0.05em',
                cursor:
                  saving || !canSubmit || phases.length === 0
                    ? 'not-allowed'
                    : 'pointer',
                transition: 'all 0.15s',
                boxShadow:
                  !saving && canSubmit && phases.length > 0
                    ? `0 0 20px ${hexToRgba(accent, 0.3)}`
                    : 'none',
              }}
            >
              {saving ? 'Creating...' : 'Create Feature'}
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
