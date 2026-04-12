// ─────────────────────────────────────────────────────────
//  Shared types for Graph and Board views
//  Both pages import from here — do not duplicate these
// ─────────────────────────────────────────────────────────

export interface Project {
  id: string
  name: string
  description: string | null
  type?: string
  cluster?: string
  created_at?: string
}

export interface Phase {
  id: string
  project_id: string
  name: string
  description: string | null
  order_index: number
  status: StatusKey
}

export interface Feature {
  id: string
  project_id: string
  phase_id: string
  name: string
  description: string | null
  type: FeatureType
  status: StatusKey
  priority: number
  assigned_model?: string
}

// Feature types as defined in the wizard generate route
export type FeatureType =
  | 'frontend'
  | 'backend'
  | 'database'
  | 'testing'
  | 'architecture'
  | string

// All valid status keys across phases and features
// Note: 'planned' is the DB default set by the wizard generate route
export type StatusKey =
  | 'planned'
  | 'todo'
  | 'in_progress'
  | 'review'
  | 'blocked'
  | 'done'
  | 'complete'

export interface StatusConfig {
  label: string
  color: string
  bg: string
  border: string
}

// Single source of truth for all status display config
// Used by: graph nodes, detail panel, board columns, status badges
export const STATUS_CONFIG: Record<string, StatusConfig> = {
  planned:     {
    label: 'Planned',
    color: 'rgba(255,255,255,0.4)',
    bg: 'rgba(255,255,255,0.04)',
    border: 'rgba(255,255,255,0.1)',
  },
  todo:        {
    label: 'To Do',
    color: '#94a3b8',
    bg: 'rgba(148,163,184,0.08)',
    border: 'rgba(148,163,184,0.2)',
  },
  in_progress: {
    label: 'In Progress',
    color: '#60a5fa',
    bg: 'rgba(96,165,250,0.08)',
    border: 'rgba(96,165,250,0.2)',
  },
  review:      {
    label: 'In Review',
    color: '#a78bfa',
    bg: 'rgba(167,139,250,0.08)',
    border: 'rgba(167,139,250,0.2)',
  },
  blocked:     {
    label: 'Blocked',
    color: '#f87171',
    bg: 'rgba(248,113,113,0.08)',
    border: 'rgba(248,113,113,0.2)',
  },
  done:        {
    label: 'Done',
    color: '#34d399',
    bg: 'rgba(52,211,153,0.08)',
    border: 'rgba(52,211,153,0.2)',
  },
  complete:    {
    label: 'Complete',
    color: '#34d399',
    bg: 'rgba(52,211,153,0.08)',
    border: 'rgba(52,211,153,0.2)',
  },
}

// Board column definitions — ordered left to right
// 'complete' is an alias for 'done' and is not shown as a separate column
export const BOARD_COLUMNS: {
  key: StatusKey
  label: string
  color: string
}[] = [
  { key: 'planned',     label: 'Planned',     color: 'rgba(255,255,255,0.4)' },
  { key: 'todo',        label: 'To Do',       color: '#94a3b8' },
  { key: 'in_progress', label: 'In Progress', color: '#60a5fa' },
  { key: 'review',      label: 'In Review',   color: '#a78bfa' },
  { key: 'blocked',     label: 'Blocked',     color: '#f87171' },
  { key: 'done',        label: 'Done',        color: '#34d399' },
]

// Feature type display config
export const FEATURE_TYPE_CONFIG: Record<string, {
  label: string
  color: string
}> = {
  frontend:     { label: 'Frontend',     color: '#60a5fa' },
  backend:      { label: 'Backend',      color: '#34d399' },
  database:     { label: 'Database',     color: '#f59e0b' },
  testing:      { label: 'Testing',      color: '#a78bfa' },
  architecture: { label: 'Architecture', color: '#f87171' },
}

// Helper: normalize 'complete' → 'done' for board column matching
export function normalizeStatus(status: string): StatusKey {
  if (status === 'complete') return 'done'
  return status as StatusKey
}

// Helper: get display config for any status, with fallback
export function getStatusConfig(status: string): StatusConfig {
  return STATUS_CONFIG[status] ?? STATUS_CONFIG['planned']
}

// Helper: get feature type display config, with fallback
export function getFeatureTypeConfig(type: string) {
  return FEATURE_TYPE_CONFIG[type] ?? {
    label: type ?? 'General',
    color: 'rgba(255,255,255,0.35)',
  }
}

// Graph node data shapes (used by ReactFlow node components)
export interface ProjectNodeData {
  [key: string]: unknown
  label: string
  featureCount: number
  doneCount: number
}

export interface PhaseNodeData {
  [key: string]: unknown
  label: string
  description: string | null
  status: StatusKey
  phaseId: string
  featureCount: number
  doneCount: number
  orderIndex: number
}

export interface FeatureNodeData {
  [key: string]: unknown
  label: string
  description: string | null
  featureType: string
  status: StatusKey
  featureId: string
  phaseId: string
  priority: number
  projectId: string
}

// Graph node types discriminator
export type GraphNodeType =
  | 'projectNode'
  | 'phaseNode'
  | 'featureNode'

import type { Node, Edge } from '@xyflow/react'

export type RFPhaseNode = Node<PhaseNodeData, 'phaseNode'>
export type RFFeatureNode = Node<FeatureNodeData, 'featureNode'>
export type RFProjectNode = Node<ProjectNodeData, 'projectNode'>
export type RFAnnotationNode = Node<{
  id: string
  text: string
  kind: 'note' | 'bug' | 'todo' | 'comment'
  color: string
  bg: string
  border: string
  emoji: string
  projectId: string
  onUpdate: (id: string, text: string) => void
  onDelete: (id: string) => void
}, 'annotationNode'>

export type AnyRFNode = RFPhaseNode | RFFeatureNode | RFProjectNode | RFAnnotationNode
export type AnyRFEdge = Edge
