-- Originally: 00000000000007_init.sql | Feature: project reminders
-- ============================================================
-- PAM Phase 3C — Project Reminders
-- Safe to run multiple times (all IF NOT EXISTS)
-- ============================================================

-- ── 1. PROJECT REMINDERS TABLE ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.project_reminders (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text        text NOT NULL,
  due_date    date,
  done        boolean DEFAULT false,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.project_reminders ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'project_reminders'
      AND policyname = 'Users can manage their project reminders'
  ) THEN
    CREATE POLICY "Users can manage their project reminders"
      ON public.project_reminders FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.projects p
          JOIN public.workspaces w ON p.workspace_id = w.id
          WHERE p.id = project_id AND w.owner_id = auth.uid()
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_reminders_project
  ON public.project_reminders(project_id, due_date ASC);

CREATE INDEX IF NOT EXISTS idx_reminders_user_due
  ON public.project_reminders(user_id, due_date ASC)
  WHERE done = false;

-- ── VERIFY ────────────────────────────────────────────────────
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'project_reminders';