-- ============================================================
-- REMINISCE V2 — GRAPH & BOARD SCHEMA PATCH
-- Run in: Supabase → SQL Editor
-- Safe to run multiple times (uses IF NOT EXISTS / DO blocks)
-- ============================================================


-- ============================================================
-- 1. PROJECTS — add missing columns
--    useProjectData selects: type, cluster
--    These were never in the original migration.
-- ============================================================

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS type    text,
  ADD COLUMN IF NOT EXISTS cluster text;


-- ============================================================
-- 2. PHASES — ensure all required columns exist
--    useProjectData selects: id, project_id, name, description,
--                             order_index, status
--    createPhase inserts:    project_id, name, description,
--                             order_index, status
--    Original migration has all of these — but status may be
--    missing on older databases. Ensure it exists.
-- ============================================================

ALTER TABLE public.phases
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'planned';

-- Ensure order_index has a sensible default so manual inserts
-- without specifying order_index don't fail.
ALTER TABLE public.phases
  ALTER COLUMN order_index SET DEFAULT 0;


-- ============================================================
-- 3. FEATURES — ensure all required columns exist
--    useProjectData selects: id, project_id, phase_id, name,
--                             description, type, status,
--                             priority, assigned_model
--    createFeature inserts:  project_id, phase_id, name,
--                             description, type, status, priority
--    Original migration has all of these.
--    Ensure priority has a working default.
-- ============================================================

ALTER TABLE public.features
  ADD COLUMN IF NOT EXISTS priority       integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS assigned_model text,
  ADD COLUMN IF NOT EXISTS type           text DEFAULT 'frontend',
  ADD COLUMN IF NOT EXISTS status         text DEFAULT 'planned';

-- Normalise any NULL priorities so ORDER BY priority works correctly
UPDATE public.features
  SET priority = 0
  WHERE priority IS NULL;


-- ============================================================
-- 4. GRAPH_NODES — ensure metadata jsonb column exists
--    graph/page.tsx reads: id, position_x, position_y, metadata
--    It writes: project_id, type, label, status,
--               position_x, position_y, metadata
--    Original migration has all of these — verify metadata
--    has the right default.
-- ============================================================

ALTER TABLE public.graph_nodes
  ALTER COLUMN metadata SET DEFAULT '{}'::jsonb;

-- Ensure no NULL metadata rows break .contains() queries
UPDATE public.graph_nodes
  SET metadata = '{}'::jsonb
  WHERE metadata IS NULL;


-- ============================================================
-- 5. INDEXES — performance for graph and board queries
--    Both views filter heavily by project_id, phase_id,
--    and order by order_index / priority.
-- ============================================================

-- Phases: project lookup + ordering
CREATE INDEX IF NOT EXISTS idx_phases_project_id
  ON public.phases(project_id);

CREATE INDEX IF NOT EXISTS idx_phases_project_order
  ON public.phases(project_id, order_index ASC);

-- Features: project lookup + priority ordering (board columns)
CREATE INDEX IF NOT EXISTS idx_features_project_id
  ON public.features(project_id);

CREATE INDEX IF NOT EXISTS idx_features_phase_id
  ON public.features(phase_id);

CREATE INDEX IF NOT EXISTS idx_features_project_priority
  ON public.features(project_id, priority ASC);

-- Features: status filtering (board column queries)
CREATE INDEX IF NOT EXISTS idx_features_project_status
  ON public.features(project_id, status);

-- Graph nodes: project lookup + metadata jsonb containment
CREATE INDEX IF NOT EXISTS idx_graph_nodes_project_id
  ON public.graph_nodes(project_id);

CREATE INDEX IF NOT EXISTS idx_graph_nodes_metadata
  ON public.graph_nodes USING gin(metadata);


-- ============================================================
-- 6. RLS POLICIES — phases and features already have policies
--    in the original migration. graph_nodes also has a policy.
--    Add any missing policies using DO blocks to avoid errors
--    if they already exist.
-- ============================================================

DO $$
BEGIN
  -- Phases: SELECT policy (original only has FOR ALL)
  -- FOR ALL already covers SELECT so no gap here.
  -- This is a safety check — no action needed.

  -- Features: same — FOR ALL already covers all operations.

  -- Graph nodes: ensure policy exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'graph_nodes'
      AND policyname = 'Users can manage graph_nodes in their projects'
  ) THEN
    CREATE POLICY "Users can manage graph_nodes in their projects"
      ON public.graph_nodes FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.projects p
          JOIN public.workspaces w ON p.workspace_id = w.id
          WHERE p.id = project_id AND w.owner_id = auth.uid()
        )
      );
  END IF;

END $$;


-- ============================================================
-- 7. STATUS VALIDATION — add check constraints for status
--    columns so invalid values can't be written.
--    Both graph DetailPanel and board drag-and-drop write
--    status directly — constrain the valid set.
-- ============================================================

-- Phases: valid status values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'phases'
      AND constraint_name = 'phases_status_check'
  ) THEN
    ALTER TABLE public.phases
      ADD CONSTRAINT phases_status_check
      CHECK (status IN (
        'planned', 'todo', 'in_progress',
        'review', 'blocked', 'done', 'complete'
      ));
  END IF;
END $$;

-- Features: valid status values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'features'
      AND constraint_name = 'features_status_check'
  ) THEN
    ALTER TABLE public.features
      ADD CONSTRAINT features_status_check
      CHECK (status IN (
        'planned', 'todo', 'in_progress',
        'review', 'blocked', 'done', 'complete'
      ));
  END IF;
END $$;

-- Features: valid type values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'features'
      AND constraint_name = 'features_type_check'
  ) THEN
    ALTER TABLE public.features
      ADD CONSTRAINT features_type_check
      CHECK (type IN (
        'frontend', 'backend', 'database',
        'testing', 'architecture'
      ));
  END IF;
END $$;


-- ============================================================
-- 8. PRIORITY REORDER FUNCTION
--    Board drag-and-drop calls reorderFeaturePriority which
--    fires N individual UPDATE calls (one per feature).
--    This server-side function does it in a single round-trip,
--    callable via supabase.rpc('reorder_features').
--
--    Parameters:
--      feature_ids  — ordered array of feature UUIDs
--                     (index 0 = priority 1, etc.)
--      p_project_id — project scope for RLS safety
-- ============================================================

CREATE OR REPLACE FUNCTION public.reorder_features(
  feature_ids  uuid[],
  p_project_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  i integer;
BEGIN
  FOR i IN 1 .. array_length(feature_ids, 1) LOOP
    UPDATE public.features
      SET priority = i
      WHERE id = feature_ids[i]
        AND project_id = p_project_id;
  END LOOP;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.reorder_features(uuid[], uuid)
  TO authenticated;


-- ============================================================
-- 9. GRAPH NODE UPSERT FUNCTION
--    graph/page.tsx currently does a SELECT then INSERT or UPDATE
--    in two separate round-trips on every drag stop.
--    This upsert collapses it to one call.
--
--    Parameters:
--      p_project_id  — project scope
--      p_original_id — the ReactFlow node id (stored in metadata)
--      p_type        — 'project' | 'phase' | 'feature'
--      p_label       — node display label
--      p_status      — node status string
--      p_x           — position x
--      p_y           — position y
-- ============================================================

CREATE OR REPLACE FUNCTION public.upsert_graph_node(
  p_project_id  uuid,
  p_original_id text,
  p_type        text,
  p_label       text,
  p_status      text,
  p_x           float,
  p_y           float
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_id uuid;
  result_id   uuid;
BEGIN
  -- Look for existing node by original_id in metadata
  SELECT id INTO existing_id
    FROM public.graph_nodes
    WHERE project_id = p_project_id
      AND metadata->>'original_id' = p_original_id
    LIMIT 1;

  IF existing_id IS NOT NULL THEN
    UPDATE public.graph_nodes
      SET position_x = p_x,
          position_y = p_y
      WHERE id = existing_id;
    result_id := existing_id;
  ELSE
    INSERT INTO public.graph_nodes (
      project_id, type, label, status,
      position_x, position_y,
      metadata
    ) VALUES (
      p_project_id, p_type, p_label, p_status,
      p_x, p_y,
      jsonb_build_object('original_id', p_original_id)
    )
    RETURNING id INTO result_id;
  END IF;

  RETURN result_id;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.upsert_graph_node(uuid, text, text, text, text, float, float)
  TO authenticated;


-- ============================================================
-- 10. BACKFILL — fix any existing data issues
--     Ensure all existing features/phases have valid status
--     and non-null priority before constraints go live.
-- ============================================================

-- Normalise any legacy status values that aren't in the
-- allowed set (e.g. 'active' used in old graph code)
UPDATE public.phases
  SET status = 'in_progress'
  WHERE status = 'active';

UPDATE public.phases
  SET status = 'planned'
  WHERE status IS NULL
     OR status NOT IN (
       'planned', 'todo', 'in_progress',
       'review', 'blocked', 'done', 'complete'
     );

UPDATE public.features
  SET status = 'in_progress'
  WHERE status = 'active';

UPDATE public.features
  SET status = 'planned'
  WHERE status IS NULL
     OR status NOT IN (
       'planned', 'todo', 'in_progress',
       'review', 'blocked', 'done', 'complete'
     );

-- Normalise feature type
UPDATE public.features
  SET type = 'frontend'
  WHERE type IS NULL
     OR type NOT IN (
       'frontend', 'backend', 'database',
       'testing', 'architecture'
     );

-- Fill missing priorities with row-number within project
-- so ORDER BY priority gives a stable result
UPDATE public.features f
  SET priority = sub.rn
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY project_id
             ORDER BY created_at ASC
           ) AS rn
    FROM public.features
    WHERE priority = 0 OR priority IS NULL
  ) sub
  WHERE f.id = sub.id;


-- ============================================================
-- VERIFY — run these SELECTs to confirm everything applied
-- ============================================================


-- Check projects has type and cluster
SELECT column_name, data_type
  FROM information_schema.columns
  WHERE table_name = 'projects'
  ORDER BY ordinal_position;

-- Check phases columns and constraint
SELECT column_name, data_type, column_default
  FROM information_schema.columns
  WHERE table_name = 'phases'
  ORDER BY ordinal_position;

-- Check features columns
SELECT column_name, data_type, column_default
  FROM information_schema.columns
  WHERE table_name = 'features'
  ORDER BY ordinal_position;

-- Check indexes created
SELECT indexname, tablename, indexdef
  FROM pg_indexes
  WHERE tablename IN ('phases', 'features', 'graph_nodes')
  ORDER BY tablename, indexname;

-- Check constraints
SELECT constraint_name, table_name, constraint_type
  FROM information_schema.table_constraints
  WHERE table_name IN ('phases', 'features')
  ORDER BY table_name, constraint_name;

-- Check functions created
SELECT routine_name, routine_type
  FROM information_schema.routines
  WHERE routine_schema = 'public'
    AND routine_name IN ('reorder_features', 'upsert_graph_node');

*/