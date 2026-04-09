-- Originally: 0000000000010_init.sql | Feature: missing columns and templates
-- ============================================================
-- Migration 9: Fill all missing columns and tables
-- Safe to run multiple times (IF NOT EXISTS throughout)
-- ============================================================

-- ── 1. user_wallets: add gems_last_granted ─────────────────
ALTER TABLE public.user_wallets
  ADD COLUMN IF NOT EXISTS gems_last_granted timestamptz;

-- ── 2. user_plans: admin and moderation columns ────────────
ALTER TABLE public.user_plans
  ADD COLUMN IF NOT EXISTS is_admin    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS banned_at   timestamptz,
  ADD COLUMN IF NOT EXISTS ban_reason  text,
  ADD COLUMN IF NOT EXISTS notes       text;

-- ── 3. provider_models: dynamic admin columns ───────────────
ALTER TABLE public.provider_models
  ADD COLUMN IF NOT EXISTS label          text,
  ADD COLUMN IF NOT EXISTS enabled        boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS tier_required  text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS cost_coins     integer,
  ADD COLUMN IF NOT EXISTS cost_gems      integer,
  ADD COLUMN IF NOT EXISTS sort_order     integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes          text;

-- Back-fill label from model_name for existing rows
UPDATE public.provider_models
  SET label = model_name
  WHERE label IS NULL;

-- ── 4. prompt_templates table (was missing entirely) ────────
CREATE TABLE IF NOT EXISTS public.prompt_templates (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title        text NOT NULL,
  content      text NOT NULL,
  tags         text[] DEFAULT '{}',
  category     text NOT NULL DEFAULT 'GENERAL',
  use_count    integer NOT NULL DEFAULT 0,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

ALTER TABLE public.prompt_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own templates"
  ON public.prompt_templates FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_prompt_templates_user
  ON public.prompt_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_category
  ON public.prompt_templates(user_id, category);

-- ── 5. admin_logs table (for admin audit trail) ─────────────
CREATE TABLE IF NOT EXISTS public.admin_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id     uuid NOT NULL REFERENCES auth.users(id),
  action       text NOT NULL,
  target_user  uuid REFERENCES auth.users(id),
  details      jsonb DEFAULT '{}',
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage admin_logs"
  ON public.admin_logs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_plans
      WHERE user_id = auth.uid() AND is_admin = true
    )
  );

-- ── 6. Set admin for your UUID ──────────────────────────────
-- Replace with your actual Supabase user UUID
UPDATE public.user_plans
  SET is_admin = true
  WHERE user_id = 'c8152b0c-5182-4e8b-8c7f-3b689902ccd6';

-- ── 7. Verify ───────────────────────────────────────────────
SELECT 'user_wallets.gems_last_granted' as check,
  count(*) > 0 as column_exists
FROM information_schema.columns
WHERE table_name = 'user_wallets' AND column_name = 'gems_last_granted'
UNION ALL
SELECT 'user_plans.is_admin',
  count(*) > 0
FROM information_schema.columns
WHERE table_name = 'user_plans' AND column_name = 'is_admin'
UNION ALL
SELECT 'provider_models.enabled',
  count(*) > 0
FROM information_schema.columns
WHERE table_name = 'provider_models' AND column_name = 'enabled'
UNION ALL
SELECT 'prompt_templates table exists',
  count(*) > 0
FROM information_schema.tables
WHERE table_name = 'prompt_templates';

-- New

ALTER TABLE public.admin_logs
  ADD COLUMN IF NOT EXISTS target_id   text,
  ADD COLUMN IF NOT EXISTS target_type text,
  ADD COLUMN IF NOT EXISTS payload     jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS target_user uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS details     jsonb DEFAULT '{}';
