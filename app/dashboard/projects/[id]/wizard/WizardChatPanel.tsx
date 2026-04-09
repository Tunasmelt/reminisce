'use client'

import { useRef, useEffect } from 'react'
import { ArrowUp, Check, Sparkles, RotateCcw, RefreshCw, AlertTriangle } from 'lucide-react'
import { GENERATION_STEPS, type ConfirmedFeature, type WizardError, type WizardStageKey } from '@/lib/wizard-stages'

interface WizardChatPanelProps {
  messages:       Array<{ role: string; content: string }>
  streamText:     string
  isStreaming:    boolean
  inputMsg:       string
  setInputMsg:    (v: string) => void
  onSend:         (override?: string) => void
  accent:         string
  currentStage:   WizardStageKey
  activeError:    WizardError | null
  // Added for functionality
  onConfirmFeatures: () => void
  onGenerate: (step: number) => void
  onShowRegen: () => void
  confirmedCount: number
  pendingFeatures: ConfirmedFeature[]
  canGenerate: boolean
  isComplete: boolean
  isGeneratingStage: boolean
  quickChips: string[]
  resumeStep: number
  lastUserMessage: string
  genCurrentStep: number
}

function hexToRgba(hex: string, a: number) {
  if (!hex || hex.length < 7) return `rgba(245,158,11,${a})`
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

function glassCard(extra?: React.CSSProperties): React.CSSProperties {
  return {
    background: 'rgba(255,255,255,0.04)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.09)',
    borderRadius: 14,
    ...extra,
  }
}

export function WizardChatPanel({
  messages, streamText, isStreaming, inputMsg,
  setInputMsg, onSend, accent, currentStage, activeError,
  onConfirmFeatures, onGenerate, onShowRegen, confirmedCount,
  pendingFeatures, canGenerate, isComplete, isGeneratingStage,
  quickChips, resumeStep, lastUserMessage, genCurrentStep
}: WizardChatPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isStreaming])

  return (
    <>
      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 8px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {messages.length === 0 && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div style={{
              width: 30, height: 30, borderRadius: 8, flexShrink: 0,
              background: hexToRgba(accent, 0.1), border: `1px solid ${hexToRgba(accent, 0.25)}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
            }}>✦</div>
            <div style={{ ...glassCard({ padding: '14px 16px', maxWidth: '85%' }), borderRadius: '16px 16px 16px 4px' }}>
              <p style={{ fontSize: 14, color: '#fff', margin: 0, lineHeight: 1.6, marginBottom: 6 }}>
                Drop your idea here — <strong>one message is enough.</strong>
              </p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: 0, lineHeight: 1.5 }}>
                Paste from ChatGPT or Gemini, or describe it in your own words.
                Features and stack suggestions appear automatically in the right panel.
              </p>
            </div>
          </div>
        )}

        {messages.filter(m => m.role !== 'system').map((msg, i) => {
          const isUser = msg.role === 'user'
          return (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexDirection: isUser ? 'row-reverse' : 'row' }}>
              <div style={{
                width: 26, height: 26, borderRadius: 7, flexShrink: 0,
                background: isUser ? hexToRgba(accent, 0.15) : 'rgba(255,255,255,0.06)',
                border: isUser ? `1px solid ${hexToRgba(accent, 0.3)}` : '1px solid rgba(255,255,255,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, color: isUser ? accent : 'rgba(255,255,255,0.5)',
              }}>
                {isUser ? 'U' : '✦'}
              </div>
              <div style={{
                background: isUser ? hexToRgba(accent, 0.12) : 'rgba(255,255,255,0.05)',
                backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
                border: isUser ? `1px solid ${hexToRgba(accent, 0.22)}` : '1px solid rgba(255,255,255,0.09)',
                borderRadius: isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                padding: '11px 15px', maxWidth: '82%',
                fontSize: 13, color: '#fff', lineHeight: 1.65,
                whiteSpace: 'pre-wrap', maxHeight: 400, overflowY: 'auto',
              }}>
                {msg.content}
              </div>
            </div>
          )
        })}

        {isStreaming && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div style={{
              width: 26, height: 26, borderRadius: 7, flexShrink: 0,
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, color: 'rgba(255,255,255,0.5)',
            }}>✦</div>
            <div style={{ ...glassCard({ padding: '12px 16px', borderRadius: '16px 16px 16px 4px' }), display: 'flex', gap: 5, alignItems: 'center' }}>
              {[0, 0.2, 0.4].map((d, i) => (
                <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgba(255,255,255,0.4)', animation: 'wBounce 1.2s infinite', animationDelay: `${d}s` }} />
              ))}
            </div>
          </div>
        )}

        {streamText && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
             <div style={{
              width: 26, height: 26, borderRadius: 7, flexShrink: 0,
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)',
            }}>
              ✦
            </div>
            <div style={{
              background: 'rgba(255,255,255,0.05)',
              backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.09)',
              borderRadius: '14px 14px 14px 4px',
              padding: '11px 15px', maxWidth: '82%',
              fontSize: 13, color: '#fff', lineHeight: 1.65,
              whiteSpace: 'pre-wrap', maxHeight: 400, overflowY: 'auto',
            }}>
              {streamText}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <style>{`
        @keyframes wPulse  { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes wBounce { 0%,80%,100%{transform:scale(0.6);opacity:0.4} 40%{transform:scale(1);opacity:1} }
      `}</style>

      {/* Error banner */}
      {activeError && (
        <div style={{
          margin: '0 16px 8px', padding: '12px 14px',
          background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.25)',
          borderRadius: 10, display: 'flex', alignItems: 'flex-start', gap: 10, flexShrink: 0,
        }}>
          <AlertTriangle size={14} color="#f87171" style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: '#f87171', fontWeight: 600, marginBottom: 4 }}>
              {activeError.message}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => onSend(lastUserMessage)} style={{
                fontSize: 10, fontWeight: 700, padding: '3px 10px',
                background: hexToRgba(accent, 0.1), border: `1px solid ${hexToRgba(accent, 0.25)}`,
                borderRadius: 6, cursor: 'pointer', color: accent,
              }}>{activeError.actionLabel || 'Retry'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Input area */}
      {!isGeneratingStage && (
        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.08)', padding: '12px 16px', flexShrink: 0,
          background: 'rgba(8,8,20,0.6)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        }}>
          {/* Confirm features CTA */}
          {currentStage === 'features' && pendingFeatures.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <button onClick={onConfirmFeatures} style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '10px', background: accent, border: 'none', borderRadius: 10, cursor: 'pointer',
                fontSize: 12, fontWeight: 800, color: '#000',
                boxShadow: `0 0 20px ${hexToRgba(accent, 0.35)}`,
              }}>
                <Check size={14} /> Confirm {confirmedCount} Feature{confirmedCount !== 1 ? 's' : ''} →
              </button>
            </div>
          )}

          {/* Generate CTA */}
          {canGenerate && (
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
              <button onClick={() => onGenerate(0)} style={{
                display: 'flex', alignItems: 'center', gap: 7,
                background: accent, color: '#000', border: 'none', borderRadius: 999,
                padding: '10px 28px', fontSize: 11, fontWeight: 800,
                letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer',
                boxShadow: `0 0 24px ${hexToRgba(accent, 0.35)}`,
              }}>
                <Sparkles size={13} /> Generate Blueprint
              </button>
            </div>
          )}

          {/* Resume */}
          {activeError?.action === 'retry_step' && resumeStep > 0 && (
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
              <button onClick={() => onGenerate(resumeStep)} style={{
                display: 'flex', alignItems: 'center', gap: 7,
                background: 'rgba(139,92,246,0.15)', color: '#a78bfa',
                border: '1px solid rgba(139,92,246,0.3)', borderRadius: 999,
                padding: '8px 20px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
              }}>
                <RotateCcw size={12} /> Resume from Step {resumeStep + 1}
              </button>
            </div>
          )}

          {/* Regenerate */}
          {isComplete && (
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
              <button onClick={onShowRegen} style={{
                display: 'flex', alignItems: 'center', gap: 7,
                background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)',
                border: '1px solid rgba(255,255,255,0.1)', borderRadius: 999,
                padding: '8px 20px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
              }}>
                <RefreshCw size={12} /> Regenerate Blueprint
              </button>
            </div>
          )}

          {/* Quick-reply chips */}
          {quickChips.length > 0 && !isStreaming && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {quickChips.map((chip, i) => (
                <button key={i} onClick={() => onSend(chip)} style={{
                  padding: '4px 11px', fontSize: 11, fontWeight: 500,
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)',
                  borderRadius: 999, cursor: 'pointer', color: 'rgba(255,255,255,0.55)', transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = hexToRgba(accent, 0.3); e.currentTarget.style.color = accent }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'; e.currentTarget.style.color = 'rgba(255,255,255,0.55)' }}
                >
                  {chip}
                </button>
              ))}
            </div>
          )}

          {/* Textarea + send */}
          <div style={{ display: 'flex', gap: 8 }}>
            <textarea
              value={inputMsg}
              onChange={e => setInputMsg(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend() } }}
              placeholder={
                isStreaming            ? 'Waiting for response...'
                : currentStage === 'idea'     ? 'Describe your project, or paste from another AI...'
                : currentStage === 'features' ? 'Ask to add, remove, or change features...'
                : currentStage === 'stack'    ? 'Ask about a stack option or describe your preference...'
                : isComplete                  ? 'Ask a follow-up or refine...'
                : 'Type a message...'
              }
              disabled={isStreaming || isGeneratingStage}
              rows={1}
              style={{
                flex: 1, background: 'rgba(255,255,255,0.05)',
                backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
                padding: '10px 14px', fontSize: 13, color: '#fff',
                outline: 'none', resize: 'none', minHeight: 42, maxHeight: 120,
                lineHeight: 1.5, fontFamily: 'inherit', transition: 'border-color 0.2s, box-shadow 0.2s',
                opacity: (isStreaming || isGeneratingStage) ? 0.5 : 1,
              }}
              onFocus={e => { e.currentTarget.style.borderColor = accent; e.currentTarget.style.boxShadow = `0 0 0 3px ${hexToRgba(accent, 0.1)}` }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.boxShadow = 'none' }}
            />
            <button onClick={() => onSend()} disabled={isStreaming || isGeneratingStage || !inputMsg.trim()} style={{
              width: 42, height: 42, borderRadius: 10, background: accent, border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              opacity: (isStreaming || isGeneratingStage || !inputMsg.trim()) ? 0.3 : 1, transition: 'opacity 0.15s',
            }}>
              <ArrowUp size={16} color="#000" />
            </button>
          </div>
          <div style={{ fontSize: 10, marginTop: 5, color: 'rgba(255,255,255,0.12)', textAlign: 'center' }}>
            Enter to send · Shift+Enter new line
          </div>
        </div>
      )}

      {/* Generating footer */}
      {isGeneratingStage && (
        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.08)', padding: '16px 20px', flexShrink: 0,
          background: 'rgba(8,8,20,0.6)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: accent, animation: 'wPulse 1s infinite' }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: accent, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {genCurrentStep >= 0 && GENERATION_STEPS[genCurrentStep] ? GENERATION_STEPS[genCurrentStep].label : 'Generating blueprint...'}
          </span>
        </div>
      )}

    </>
  )
}
