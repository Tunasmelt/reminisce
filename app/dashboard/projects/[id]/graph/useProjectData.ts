'use client'

import { useState, useCallback, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import type {
  Project,
  Phase,
  Feature,
  StatusKey,
  FeatureType,
} from './types'

// ─────────────────────────────────────────────────────────
//  useProjectData
//
//  Single data hook shared by Graph and Board views.
//  Handles all fetching and mutations for:
//    - project metadata
//    - phases (create, update, delete, reorder)
//    - features (create, update, delete, reorder priority)
//
//  Usage:
//    const { project, phases, features, loading, refetch, ... }
//      = useProjectData(projectId)
// ─────────────────────────────────────────────────────────

export interface UseProjectDataReturn {
  // Data
  project: Project | null
  phases: Phase[]
  features: Feature[]
  loading: boolean

  // Refetch everything
  refetch: () => Promise<void>

  // Phase mutations
  createPhase: (input: {
    name: string
    description: string
  }) => Promise<Phase | null>

  updatePhase: (
    phaseId: string,
    updates: Partial<Pick<Phase, 'name' | 'description' | 'status'>>
  ) => Promise<void>

  deletePhase: (phaseId: string) => Promise<void>

  // Feature mutations
  createFeature: (input: {
    name: string
    description: string
    type: FeatureType
    phaseId: string
  }) => Promise<Feature | null>

  updateFeature: (
    featureId: string,
    updates: Partial<Pick<
      Feature,
      'name' | 'description' | 'status' | 'type' | 'priority' | 'phase_id'
    >>
  ) => Promise<void>

  deleteFeature: (featureId: string) => Promise<void>

  // Priority reordering (used by Board drag-and-drop)
  reorderFeaturePriority: (
    phaseId: string,
    orderedFeatureIds: string[]
  ) => Promise<void>

  // Status shortcut (used by both Graph panel and Board)
  setFeatureStatus: (
    featureId: string,
    status: StatusKey
  ) => Promise<void>

  setPhaseStatus: (
    phaseId: string,
    status: StatusKey
  ) => Promise<void>
}

export function useProjectData(
  projectId: string
): UseProjectDataReturn {
  const CACHE_KEY = `reminisce_project_cache_${projectId}`

  const getCached = () => {
    if (typeof window === 'undefined') return null
    try {
      const raw = localStorage.getItem(CACHE_KEY)
      return raw ? JSON.parse(raw) : null
    } catch { return null }
  }

  const cached = getCached()

  const [project, setProject] = useState<Project | null>(cached?.project ?? null)
  const [phases, setPhases] = useState<Phase[]>(cached?.phases ?? [])
  const [features, setFeatures] = useState<Feature[]>(cached?.features ?? [])
  const [loading, setLoading] = useState(!cached)  // only show loading if no cache

  // ── Fetch ──────────────────────────────────────────────

  const refetch = useCallback(async () => {
    if (!projectId) return
    try {
      const [
        { data: projData, error: projErr },
        { data: phasesData, error: phasesErr },
        { data: featuresData, error: featuresErr },
      ] = await Promise.all([
        supabase
          .from('projects')
          .select('id, name, description, type, cluster, created_at')
          .eq('id', projectId)
          .single(),
        supabase
          .from('phases')
          .select('id, project_id, name, description, order_index, status')
          .eq('project_id', projectId)
          .order('order_index', { ascending: true }),
        supabase
          .from('features')
          .select(
            'id, project_id, phase_id, name, description, type, status, priority, assigned_model'
          )
          .eq('project_id', projectId)
          .order('priority', { ascending: true }),
      ])

      if (projErr) throw projErr
      if (phasesErr) throw phasesErr
      if (featuresErr) throw featuresErr

      setProject(projData as Project)
      setPhases((phasesData ?? []) as Phase[])
      setFeatures((featuresData ?? []) as Feature[])

      // Save to localStorage cache
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          project: projData,
          phases: phasesData ?? [],
          features: featuresData ?? [],
          cachedAt: Date.now(),
        }))
      } catch { /* non-fatal */ }
    } catch (err) {
      console.error('[useProjectData] fetch error:', err)
      toast.error('Failed to load project data')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    setLoading(true)
    refetch()
  }, [refetch])

  // ── Phase mutations ────────────────────────────────────

  const createPhase = useCallback(
    async (input: {
      name: string
      description: string
    }): Promise<Phase | null> => {
      try {
        // Auto-assign order_index as max existing + 1
        const maxOrder = phases.reduce(
          (max, p) => Math.max(max, p.order_index ?? 0),
          -1
        )

        const { data, error } = await supabase
          .from('phases')
          .insert({
            project_id: projectId,
            name: input.name.trim(),
            description: input.description.trim(),
            order_index: maxOrder + 1,
            status: 'planned',
          })
          .select(
            'id, project_id, name, description, order_index, status'
          )
          .single()

        if (error) throw error

        const newPhase = data as Phase
        // Optimistic update
        setPhases(prev => [...prev, newPhase])
        toast.success('Phase created')
        return newPhase
      } catch (err) {
        console.error('[useProjectData] createPhase error:', err)
        toast.error('Failed to create phase')
        return null
      }
    },
    [projectId, phases]
  )

  const updatePhase = useCallback(
    async (
      phaseId: string,
      updates: Partial<Pick<Phase, 'name' | 'description' | 'status'>>
    ): Promise<void> => {
      try {
        const { error } = await supabase
          .from('phases')
          .update(updates)
          .eq('id', phaseId)

        if (error) throw error

        // Optimistic update
        setPhases(prev =>
          prev.map(p =>
            p.id === phaseId ? { ...p, ...updates } : p
          )
        )
      } catch (err) {
        console.error('[useProjectData] updatePhase error:', err)
        toast.error('Failed to update phase')
      }
    },
    []
  )

  const deletePhase = useCallback(
    async (phaseId: string): Promise<void> => {
      try {
        // Features cascade delete via DB foreign key,
        // but we also remove them from local state explicitly
        const { error } = await supabase
          .from('phases')
          .delete()
          .eq('id', phaseId)

        if (error) throw error

        // Optimistic update — remove phase and its features
        setPhases(prev => prev.filter(p => p.id !== phaseId))
        setFeatures(prev =>
          prev.filter(f => f.phase_id !== phaseId)
        )
        toast.success('Phase deleted')
      } catch (err) {
        console.error('[useProjectData] deletePhase error:', err)
        toast.error('Failed to delete phase')
      }
    },
    []
  )

  // ── Feature mutations ──────────────────────────────────

  const createFeature = useCallback(
    async (input: {
      name: string
      description: string
      type: FeatureType
      phaseId: string
    }): Promise<Feature | null> => {
      try {
        // Auto-assign priority as max within this phase + 1
        const phaseFeatures = features.filter(
          f => f.phase_id === input.phaseId
        )
        const maxPriority = phaseFeatures.reduce(
          (max, f) => Math.max(max, f.priority ?? 0),
          0
        )

        const { data, error } = await supabase
          .from('features')
          .insert({
            project_id: projectId,
            phase_id: input.phaseId,
            name: input.name.trim(),
            description: input.description.trim(),
            type: input.type,
            status: 'planned',
            priority: maxPriority + 1,
          })
          .select(
            'id, project_id, phase_id, name, description, type, status, priority, assigned_model'
          )
          .single()

        if (error) throw error

        const newFeature = data as Feature
        // Optimistic update
        setFeatures(prev => [...prev, newFeature])
        toast.success('Feature created')
        return newFeature
      } catch (err) {
        console.error('[useProjectData] createFeature error:', err)
        toast.error('Failed to create feature')
        return null
      }
    },
    [projectId, features]
  )

  const updateFeature = useCallback(
    async (
      featureId: string,
      updates: Partial<Pick<
        Feature,
        'name' | 'description' | 'status' | 'type' | 'priority' | 'phase_id'
      >>
    ): Promise<void> => {
      try {
        const { error } = await supabase
          .from('features')
          .update(updates)
          .eq('id', featureId)

        if (error) throw error

        // Optimistic update
        setFeatures(prev =>
          prev.map(f =>
            f.id === featureId ? { ...f, ...updates } : f
          )
        )
      } catch (err) {
        console.error('[useProjectData] updateFeature error:', err)
        toast.error('Failed to update feature')
      }
    },
    []
  )

  const deleteFeature = useCallback(
    async (featureId: string): Promise<void> => {
      try {
        const { error } = await supabase
          .from('features')
          .delete()
          .eq('id', featureId)

        if (error) throw error

        // Optimistic update
        setFeatures(prev =>
          prev.filter(f => f.id !== featureId)
        )
        toast.success('Feature deleted')
      } catch (err) {
        console.error('[useProjectData] deleteFeature error:', err)
        toast.error('Failed to delete feature')
      }
    },
    []
  )

  // ── Priority reordering ────────────────────────────────
  // Called by Board when user drags a card within a column.
  // orderedFeatureIds = the new desired order (top to bottom).

  const reorderFeaturePriority = useCallback(
    async (
      phaseId: string,
      orderedFeatureIds: string[]
    ): Promise<void> => {
      try {
        // Optimistic update first for instant UI response
        setFeatures(prev => {
          const updated = [...prev]
          orderedFeatureIds.forEach((id, index) => {
            const feature = updated.find(f => f.id === id)
            if (feature) feature.priority = index + 1
          })
          return updated.sort((a, b) => a.priority - b.priority)
        })

        // Batch update all affected features
        await Promise.all(
          orderedFeatureIds.map((featureId, index) =>
            supabase
              .from('features')
              .update({ priority: index + 1 })
              .eq('id', featureId)
          )
        )
      } catch (err) {
        console.error(
          '[useProjectData] reorderFeaturePriority error:',
          err
        )
        toast.error('Failed to save priority order')
        // Refetch to restore correct state on failure
        await refetch()
      }
    },
    [refetch]
  )

  // ── Status shortcuts ───────────────────────────────────

  const setFeatureStatus = useCallback(
    async (featureId: string, status: StatusKey): Promise<void> => {
      await updateFeature(featureId, { status })
    },
    [updateFeature]
  )

  const setPhaseStatus = useCallback(
    async (phaseId: string, status: StatusKey): Promise<void> => {
      await updatePhase(phaseId, { status })
    },
    [updatePhase]
  )

  // ──────────────────────────────────────────────────────

  return {
    project,
    phases,
    features,
    loading,
    refetch,
    createPhase,
    updatePhase,
    deletePhase,
    createFeature,
    updateFeature,
    deleteFeature,
    reorderFeaturePriority,
    setFeatureStatus,
    setPhaseStatus,
  }
}
