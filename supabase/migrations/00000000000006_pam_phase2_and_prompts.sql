-- Run in Supabase SQL Editor
-- PAM Phase 2 + Prompts Studio Schema Patch

-- ============================================================
-- PAM Phase 2 + Prompts Studio Schema Patch
-- Safe to run multiple times (all IF NOT EXISTS / DO blocks)
-- ============================================================

-- ── 1. PAM THREAD SUMMARIES ──────────────────────────────────
-- When a thread is closed/archived, a compressed summary is
-- stored here. New threads inject these summaries as memory.

CREATE TABLE IF NOT EXISTS public.pam_thread_summaries (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id   uuid NOT NULL REFERENCES public.pam_threads(id) ON DELETE CASCADE,
  project_id  uuid NOT NULL REFERENCES public.projects(id)   ON DELETE CASCADE,
  summary     text NOT NULL,
  message_count integer,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.pam_thread_summaries ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'pam_thread_summaries'
      AND policyname = 'Users can manage their thread summaries'
  ) THEN
    CREATE POLICY "Users can manage their thread summaries"
      ON public.pam_thread_summaries FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.projects p
          JOIN public.workspaces w ON p.workspace_id = w.id
          WHERE p.id = project_id AND w.owner_id = auth.uid()
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pam_summaries_project
  ON public.pam_thread_summaries(project_id, created_at DESC);

-- ── 2. PAM THREADS — add summarised flag ─────────────────────
ALTER TABLE public.pam_threads
  ADD COLUMN IF NOT EXISTS summarised boolean DEFAULT false;

-- ── 3. PROMPTS TABLE — add missing columns ───────────────────
-- The wizard generates prompts but the Prompts Studio UI
-- references title and is_master_prompt which were written
-- in prompt generation logic but never added to the DB schema.

ALTER TABLE public.prompts
  ADD COLUMN IF NOT EXISTS title            text,
  ADD COLUMN IF NOT EXISTS is_master_prompt boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS phase_id         uuid REFERENCES public.phases(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS context_files    text[],
  ADD COLUMN IF NOT EXISTS checklist        jsonb,
  ADD COLUMN IF NOT EXISTS expected_output  text,
  ADD COLUMN IF NOT EXISTS model_suggested  text,
  ADD COLUMN IF NOT EXISTS updated_at       timestamptz DEFAULT now();

-- ── 4. INDEX for prompt lookups ──────────────────────────────
CREATE INDEX IF NOT EXISTS idx_prompts_project_phase
  ON public.prompts(project_id, phase_id);

CREATE INDEX IF NOT EXISTS idx_prompts_master
  ON public.prompts(project_id, is_master_prompt)
  WHERE is_master_prompt = true;

-- ── 5. PROJECT MEMBERS TABLE ─────────────────────────────────
-- DB infrastructure exists, UI still needs building.
-- This patch ensures the table and its 5-member cap trigger exist.

CREATE TABLE IF NOT EXISTS public.project_members (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        text NOT NULL DEFAULT 'member',
  invited_at  timestamptz DEFAULT now(),
  UNIQUE(project_id, user_id)
);

ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'project_members'
      AND policyname = 'Users can manage members in their projects'
  ) THEN
    CREATE POLICY "Users can manage members in their projects"
      ON public.project_members FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.projects p
          JOIN public.workspaces w ON p.workspace_id = w.id
          WHERE p.id = project_id AND w.owner_id = auth.uid()
        )
      );
  END IF;
END $$;

-- 5-member cap trigger
CREATE OR REPLACE FUNCTION public.enforce_member_limit()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (
    SELECT COUNT(*) FROM public.project_members
    WHERE project_id = NEW.project_id
  ) >= 5 THEN
    RAISE EXCEPTION 'Project member limit (5) reached';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS check_member_limit ON public.project_members;
CREATE TRIGGER check_member_limit
  BEFORE INSERT ON public.project_members
  FOR EACH ROW EXECUTE FUNCTION public.enforce_member_limit();

-- ── VERIFY ────────────────────────────────────────────────────
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('pam_thread_summaries','project_members');

SELECT column_name FROM information_schema.columns
WHERE table_name = 'prompts'
  AND column_name IN ('title','is_master_prompt','phase_id','updated_at');