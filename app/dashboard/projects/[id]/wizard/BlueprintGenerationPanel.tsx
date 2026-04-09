'use client'

import { AlertTriangle, CheckCircle2, Check } from 'lucide-react'
import { GENERATION_STEPS } from '@/lib/wizard-stages'

function hexToRgba(hex: string, a: number) {
  if (!hex || hex.length < 7) return `rgba(245,158,11,${a})`
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

export function GenerationStepsPanel({
  steps, currentStep, completedSteps, errorStep, accent,
}: {
  steps: typeof GENERATION_STEPS
  currentStep: number
  completedSteps: number[]
  errorStep: number | null
  accent: string
}) {
  const waves = [
    { wave: 1, label: 'Wave 1 — Parallel', steps: steps.filter(s => s.wave === 1) },
    { wave: 2, label: 'Wave 2 — Parallel', steps: steps.filter(s => s.wave === 2) },
    { wave: 3, label: 'Wave 3 — Synthesis', steps: steps.filter(s => s.wave === 3) },
  ]
  return (
    <div style={{ padding: 24 }}>
      <div style={{
        fontSize: 9, fontWeight: 800, letterSpacing: '0.14em',
        color: accent, textTransform: 'uppercase', marginBottom: 20,
      }}>
        Generating Blueprint
      </div>
      {waves.map(({ wave, label, steps: ws }) => {
        const waveCompleted = ws.every(s => completedSteps.includes(s.index))
        const waveActive    = ws.some(s => s.index === currentStep)
        return (
          <div key={wave} style={{ marginBottom: 20 }}>
            <div style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
              color: waveCompleted ? '#10b981' : waveActive ? accent : 'rgba(255,255,255,0.2)',
              marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6,
            }}>
              {waveCompleted
                ? <Check size={10} color="#10b981" />
                : waveActive
                  ? <div style={{ width: 8, height: 8, borderRadius: '50%', background: accent, animation: 'wPulse 1s infinite' }} />
                  : <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
              }
              {label}
              {ws.length > 1 && waveActive && (
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>running in parallel</span>
              )}
            </div>
            <div style={{ paddingLeft: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {ws.map(step => {
                const done    = completedSteps.includes(step.index)
                const running = step.index === currentStep
                const failed  = errorStep === step.index
                return (
                  <div key={step.index} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '12px 16px', borderRadius: 12,
                    background: running
                      ? hexToRgba(accent, 0.06)
                      : done ? 'rgba(16,185,129,0.04)' : 'rgba(255,255,255,0.025)',
                    border: `1px solid ${running
                      ? hexToRgba(accent, 0.2)
                      : done ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.06)'}`,
                    transition: 'all 0.2s',
                  }}>
                    <div style={{
                      width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                      background: failed ? '#ef4444' : done ? '#10b981' : running ? accent : 'rgba(255,255,255,0.15)',
                      animation: running ? 'wPulse 1s infinite' : 'none',
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 12, fontWeight: 600,
                        color: done ? '#10b981' : running ? '#fff' : 'rgba(255,255,255,0.4)',
                      }}>
                        {step.label}
                      </div>
                      {running && (
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>
                          {step.description}
                        </div>
                      )}
                    </div>
                    {done && <CheckCircle2 size={13} color="#10b981" />}
                    {failed && <AlertTriangle size={13} color="#ef4444" />}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
