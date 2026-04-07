-- ============================================================
-- Rehaul Phase 1 — Context Management, Git Integration,
-- Prompt Library, and Editor Preference Schema
-- Migration: 00000000000008
-- Safe to run multiple times (all IF NOT EXISTS / DO blocks)
-- ============================================================

-- ── 1. PROJECTS — git and editor columns ─────────────────────
-- repo_provider: which git host (github / gitlab / bitbucket / other)
-- editor_preference: which AI coding editor the user uses
--   values: 'cursor' | 'claude-code' | 'copilot' | 'windsurf' | 'generic'
-- git_branch: current local branch, refreshed by focus sync
-- git_last_commit: last commit message, refreshed by focus sync

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS repo_provider       text,
  ADD COLUMN IF NOT EXISTS editor_preference   text DEFAULT 'generic',
  ADD COLUMN IF NOT EXISTS git_branch          text,
  ADD COLUMN IF NOT EXISTS git_last_commit     text;

-- ── 2. CONTEXTS — sync, ownership, and summary columns ───────
-- summary: extracted from <!-- REMINISCE:SUMMARY --> tag in file.
--   Stored separately so PAM can inject summaries without loading
--   full file content. ~100-200 words per file.
-- owned_by: controls overwrite behaviour on regeneration.
--   'reminisce' = overwritten by wizard on regeneration
--   'developer'  = never overwritten (logs/, developer edits)
--   'shared'     = Reminisce writes base, developer can append
-- file_hash: SHA-256 of content string.
--   Used to detect conflicts between local edits and DB version.
--   Computed client-side before any sync operation.
-- last_synced_at: timestamp of last successful local ↔ DB sync.
--   Used to determine staleness and surface sync indicators.

ALTER TABLE public.contexts
  ADD COLUMN IF NOT EXISTS summary         text,
  ADD COLUMN IF NOT EXISTS owned_by        text DEFAULT 'reminisce',
  ADD COLUMN IF NOT EXISTS file_hash       text,
  ADD COLUMN IF NOT EXISTS last_synced_at  timestamptz;

-- ── 3. PROMPTS — usage tracking columns ──────────────────────
-- run_count: incremented each time this prompt is used via
--   agent/run route or copied from prompt library.
--   Used to sort prompts by usage and show "most used" badge.
-- last_used_at: timestamp of last use.
--   Used in prompt library Changelog tab and for sorting.
-- NOTE: title, is_master_prompt, phase_id, context_files,
--   checklist, expected_output, model_suggested, updated_at
--   were all added in migration 00000000000006. Not repeated here.

ALTER TABLE public.prompts
  ADD COLUMN IF NOT EXISTS run_count    integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_used_at timestamptz;

-- ── 4. INDEXES ────────────────────────────────────────────────
-- Fast lookup of context files by ownership (for sync engine
-- to know which files it can overwrite vs which to preserve)
CREATE INDEX IF NOT EXISTS idx_contexts_project_owned
  ON public.contexts(project_id, owned_by);

-- Fast lookup of context files by file_path within a project
-- (used by sync engine to find specific files without scanning)
CREATE INDEX IF NOT EXISTS idx_contexts_project_path
  ON public.contexts(project_id, file_path);

-- Fast lookup of projects by repo_provider
-- (used when enriching wizard context from GitHub metadata)
CREATE INDEX IF NOT EXISTS idx_projects_repo_provider
  ON public.projects(repo_provider)
  WHERE repo_provider IS NOT NULL;

-- Fast lookup of most-used prompts per project
CREATE INDEX IF NOT EXISTS idx_prompts_run_count
  ON public.prompts(project_id, run_count DESC);

-- ── 5. RLS POLICY CHECK ───────────────────────────────────────
-- contexts table already has RLS enabled from migration 0.
-- New columns inherit existing policies automatically.
-- No new policies needed. Verify existing policy is present:

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'contexts'
      AND schemaname = 'public'
  ) THEN
    RAISE EXCEPTION
      'contexts table has no RLS policies — check migration 0 ran correctly';
  END IF;
END $$;

-- ── 6. VERIFY ─────────────────────────────────────────────────
-- These SELECTs should all return rows. Report their output.

SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'projects'
  AND column_name IN (
    'repo_provider', 'editor_preference',
    'git_branch', 'git_last_commit'
  )
ORDER BY column_name;

SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'contexts'
  AND column_name IN (
    'summary', 'owned_by', 'file_hash', 'last_synced_at'
  )
ORDER BY column_name;

SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'prompts'
  AND column_name IN ('run_count', 'last_used_at')
ORDER BY column_name;

SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('contexts', 'projects', 'prompts')
  AND indexname IN (
    'idx_contexts_project_owned',
    'idx_contexts_project_path',
    'idx_projects_repo_provider',
    'idx_prompts_run_count'
  )
ORDER BY indexname;