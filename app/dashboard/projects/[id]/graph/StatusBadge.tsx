'use client'

import { getStatusConfig, getFeatureTypeConfig } from './types'

// ─────────────────────────────────────────────────────────
//  StatusBadge
//
//  Renders a glass pill badge for any status key.
//  Used by: graph nodes, detail panel, board cards.
//
//  Props:
//    status   — any StatusKey string (planned, todo, in_progress, etc.)
//    size     — 'sm' (default) | 'md'
//    pulse    — show animated pulse dot (for in_progress)
// ─────────────────────────────────────────────────────────

interface StatusBadgeProps {
  status: string
  size?: 'sm' | 'md'
  pulse?: boolean
}

export function StatusBadge({
  status,
  size = 'sm',
  pulse = false,
}: StatusBadgeProps) {
  const cfg = getStatusConfig(status)
  const showPulse =
    pulse && (status === 'in_progress' || status === 'active')

  const fontSize = size === 'md' ? 10 : 9
  const padding = size === 'md' ? '4px 10px' : '3px 8px'
  const dotSize = size === 'md' ? 7 : 6

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontSize,
        fontWeight: 700,
        letterSpacing: '0.07em',
        textTransform: 'uppercase',
        color: cfg.color,
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        borderRadius: 999,
        padding,
        whiteSpace: 'nowrap',
        lineHeight: 1,
      }}
    >
      <span
        style={{
          width: dotSize,
          height: dotSize,
          borderRadius: '50%',
          background: cfg.color,
          flexShrink: 0,
          animation: showPulse
            ? 'agentPulse 1.5s ease-in-out infinite'
            : 'none',
        }}
      />
      {cfg.label}
    </span>
  )
}

// ─────────────────────────────────────────────────────────
//  FeatureTypeBadge
//
//  Renders a small type tag for a feature (frontend, backend, etc.)
//  Used by: graph feature nodes, board cards, detail panel.
// ─────────────────────────────────────────────────────────

interface FeatureTypeBadgeProps {
  type: string
  size?: 'sm' | 'md'
}

export function FeatureTypeBadge({
  type,
  size = 'sm',
}: FeatureTypeBadgeProps) {
  const cfg = getFeatureTypeConfig(type)

  const fontSize = size === 'md' ? 10 : 9
  const padding = size === 'md' ? '4px 10px' : '3px 8px'

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontSize,
        fontWeight: 700,
        letterSpacing: '0.07em',
        textTransform: 'uppercase',
        color: cfg.color,
        background: `${cfg.color}14`,
        border: `1px solid ${cfg.color}30`,
        borderRadius: 999,
        padding,
        whiteSpace: 'nowrap',
        lineHeight: 1,
      }}
    >
      {cfg.label}
    </span>
  )
}

// ─────────────────────────────────────────────────────────
//  PriorityBadge
//
//  Renders a subtle priority number indicator.
//  Used by: board cards, detail panel.
// ─────────────────────────────────────────────────────────

interface PriorityBadgeProps {
  priority: number
}

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 9,
        fontWeight: 800,
        letterSpacing: '0.04em',
        color: 'rgba(255,255,255,0.3)',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.09)',
        borderRadius: 6,
        padding: '2px 6px',
        lineHeight: 1,
        minWidth: 20,
        fontFamily:
          'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      }}
    >
      #{priority}
    </span>
  )
}

// ─────────────────────────────────────────────────────────
//  ProgressRing
//
//  Renders a small SVG ring showing completion percentage.
//  Used by: phase nodes in graph, phase header in board.
//
//  Props:
//    total   — total features in phase
//    done    — completed features in phase
//    size    — ring diameter in px (default 28)
//    color   — ring fill color (default green)
// ─────────────────────────────────────────────────────────

interface ProgressRingProps {
  total: number
  done: number
  size?: number
  color?: string
}

export function ProgressRing({
  total,
  done,
  size = 28,
  color = '#34d399',
}: ProgressRingProps) {
  const pct = total > 0 ? done / total : 0
  const radius = (size - 4) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference * (1 - pct)

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ flexShrink: 0, transform: 'rotate(-90deg)' }}
    >
      {/* Track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth={2}
      />
      {/* Fill */}
      {total > 0 && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{ transition: 'stroke-dashoffset 0.4s ease' }}
        />
      )}
      {/* Center text — rotated back upright */}
      <text
        x={size / 2}
        y={size / 2}
        textAnchor="middle"
        dominantBaseline="central"
        style={{
          transform: `rotate(90deg)`,
          transformOrigin: `${size / 2}px ${size / 2}px`,
          fontSize: size < 32 ? 7 : 9,
          fontWeight: 800,
          fill: pct === 1 ? color : 'rgba(255,255,255,0.5)',
          fontFamily: 'ui-monospace, monospace',
        }}
      >
        {total === 0 ? '—' : `${Math.round(pct * 100)}%`}
      </text>
    </svg>
  )
}
