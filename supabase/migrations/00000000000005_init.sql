-- ============================================================
-- PAM (Project Action Manager) — Phase 1 Schema
-- Safe to run multiple times (all IF NOT EXISTS)
-- ============================================================

-- ── 1. PAM THREADS ───────────────────────────────────────────
-- Each thread is a named conversation session within a project.
-- Threads replace the flat agent_runs model for multi-turn chat.
-- agent_runs is kept intact for backward compatibility.

CREATE TABLE IF NOT EXISTS public.pam_threads (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id)    ON DELETE CASCADE,
  title         text,           -- null = auto-set from first message
  model_used    text,           -- last model used in this thread
  provider_used text,           -- last provider used in this thread
  message_count integer DEFAULT 0,
  last_message_at timestamptz DEFAULT now(),
  archived      boolean DEFAULT false,
  created_at    timestamptz DEFAULT now()
);

-- ── 2. PAM MESSAGES ──────────────────────────────────────────
-- Each row is one turn in a thread.
-- role: 'user' | 'assistant' | 'system'
-- action_payload: structured JSON when PAM proposes an action
-- action_confirmed: null=pending, true=confirmed, false=rejected

CREATE TABLE IF NOT EXISTS public.pam_messages (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id        uuid NOT NULL REFERENCES public.pam_threads(id) ON DELETE CASCADE,
  project_id       uuid NOT NULL REFERENCES public.projects(id)   ON DELETE CASCADE,
  role             text NOT NULL CHECK (role IN ('user','assistant','system')),
  content          text NOT NULL,
  model_used       text,
  tokens_used      integer,
  action_type      text,     -- e.g. 'UPDATE_FEATURE_STATUS', 'CREATE_PROMPT', 'UPDATE_PHASE_STATUS'
  action_payload   jsonb,    -- structured data for the action
  action_confirmed boolean,  -- null=pending confirm, true=done, false=rejected
  created_at       timestamptz DEFAULT now()
);

-- ── 3. INDEXES ────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_pam_threads_project
  ON public.pam_threads(project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pam_threads_user
  ON public.pam_threads(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pam_messages_thread
  ON public.pam_messages(thread_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_pam_messages_project
  ON public.pam_messages(project_id, created_at DESC);

-- ── 4. RLS ────────────────────────────────────────────────────

ALTER TABLE public.pam_threads  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pam_messages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'pam_threads'
      AND policyname = 'Users can manage their pam_threads'
  ) THEN
    CREATE POLICY "Users can manage their pam_threads"
      ON public.pam_threads FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.projects p
          JOIN public.workspaces w ON p.workspace_id = w.id
          WHERE p.id = project_id AND w.owner_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'pam_messages'
      AND policyname = 'Users can manage their pam_messages'
  ) THEN
    CREATE POLICY "Users can manage their pam_messages"
      ON public.pam_messages FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.projects p
          JOIN public.workspaces w ON p.workspace_id = w.id
          WHERE p.id = project_id AND w.owner_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ── 5. AUTO-TITLE FUNCTION ───────────────────────────────────
-- Called after first user message to set thread title
-- from the first 60 chars of that message.

CREATE OR REPLACE FUNCTION public.pam_auto_title()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only act on the first user message in a thread
  IF NEW.role = 'user' AND (
    SELECT COUNT(*) FROM public.pam_messages
    WHERE thread_id = NEW.thread_id AND role = 'user'
  ) = 1 THEN
    UPDATE public.pam_threads
    SET title = LEFT(NEW.content, 60)
    WHERE id = NEW.thread_id AND title IS NULL;
  END IF;

  -- Increment message count and update last_message_at
  UPDATE public.pam_threads
  SET
    message_count   = message_count + 1,
    last_message_at = NOW()
  WHERE id = NEW.thread_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pam_message_after_insert ON public.pam_messages;
CREATE TRIGGER pam_message_after_insert
  AFTER INSERT ON public.pam_messages
  FOR EACH ROW EXECUTE FUNCTION public.pam_auto_title();

-- ── VERIFY ────────────────────────────────────────────────────
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('pam_threads', 'pam_messages');