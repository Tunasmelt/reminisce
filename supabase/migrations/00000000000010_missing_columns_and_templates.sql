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

-- New

-- Clear old seeded models
DELETE FROM public.provider_models;

-- Seed verified working models
INSERT INTO public.provider_models
  (provider, model_id, model_name, label, is_free, enabled, tier_required, sort_order)
VALUES
  -- Groq (most reliable free tier)
  ('groq', 'llama-3.1-8b-instant',     'Llama 3.1 8B',        'Llama 3.1 8B ⚡',         true,  true, 'free', 1),
  ('groq', 'llama-3.3-70b-versatile',  'Llama 3.3 70B',       'Llama 3.3 70B',             true,  true, 'free', 2),
  ('groq', 'gemma2-9b-it',             'Gemma 2 9B',          'Gemma 2 9B',                true,  true, 'free', 3),
  ('groq', 'llama-3.2-3b-preview',     'Llama 3.2 3B',        'Llama 3.2 3B ⚡',          true,  true, 'free', 4),
  -- Cerebras
  ('cerebras', 'llama3.1-8b',           'Llama 3.1 8B',        'Llama 3.1 8B (Cerebras) ⚡', true, true, 'free', 10),
  ('cerebras', 'llama-3.3-70b',         'Llama 3.3 70B',       'Llama 3.3 70B (Cerebras)', true,  true, 'free', 11),
  -- Gemini free
  ('gemini', 'gemini-2.0-flash',        'Gemini 2.0 Flash',    'Gemini 2.0 Flash',          true,  true, 'free', 20),
  ('gemini', 'gemini-1.5-flash',        'Gemini 1.5 Flash',    'Gemini 1.5 Flash',          true,  true, 'free', 21),
  ('gemini', 'gemini-1.5-flash-8b',     'Gemini 1.5 Flash 8B', 'Gemini 1.5 Flash 8B ⚡',   true,  true, 'free', 22),
  -- Mistral free
  ('mistral', 'open-mistral-7b',        'Mistral 7B',          'Mistral 7B',                true,  true, 'free', 30),
  ('mistral', 'mistral-small-latest',   'Mistral Small',       'Mistral Small',             true,  true, 'free', 31),
  -- OpenRouter free (confirmed working)
  ('openrouter', 'meta-llama/llama-3.3-70b-instruct:free', 'Llama 3.3 70B', 'Llama 3.3 70B (OR)', true, true, 'free', 40),
  ('openrouter', 'meta-llama/llama-3.1-8b-instruct:free',  'Llama 3.1 8B',  'Llama 3.1 8B (OR) ⚡', true, true, 'free', 41),
  ('openrouter', 'mistralai/mistral-7b-instruct:free',     'Mistral 7B',    'Mistral 7B (OR)',   true, true, 'free', 42),
  ('openrouter', 'qwen/qwen-2.5-72b-instruct:free',        'Qwen 2.5 72B',  'Qwen 2.5 72B',     true, true, 'free', 43),
  ('openrouter', 'google/gemma-3-12b-it:free',             'Gemma 3 12B',   'Gemma 3 12B',      true, true, 'free', 44),
  ('openrouter', 'microsoft/phi-3-mini-128k-instruct:free','Phi-3 Mini',    'Phi-3 Mini ⚡',    true, true, 'free', 45),
  -- Pro tier
  ('anthropic', 'claude-3-5-haiku-20241022',  'Claude 3.5 Haiku', 'Claude 3.5 Haiku', false, true, 'pro', 100),
  ('anthropic', 'claude-sonnet-4-20250514',   'Claude Sonnet 4',  'Claude Sonnet 4',  false, true, 'pro', 101),
  ('openai',    'gpt-4o-mini',                'GPT-4o Mini',      'GPT-4o Mini',      false, true, 'pro', 110),
  ('openai',    'gpt-4o',                     'GPT-4o',           'GPT-4o',           false, true, 'pro', 111),
  ('gemini',    'gemini-2.5-flash',           'Gemini 2.5 Flash', 'Gemini 2.5 Flash', false, true, 'pro', 120),
  ('gemini',    'gemini-2.5-pro',             'Gemini 2.5 Pro',   'Gemini 2.5 Pro',   false, true, 'pro', 121),
  ('mistral',   'mistral-large-latest',       'Mistral Large',    'Mistral Large',    false, true, 'pro', 130),
  ('mistral',   'codestral-latest',           'Codestral',        'Codestral',        false, true, 'pro', 131)
ON CONFLICT (provider, model_id) DO UPDATE
  SET label = EXCLUDED.label,
      enabled = EXCLUDED.enabled,
      tier_required = EXCLUDED.tier_required,
      sort_order = EXCLUDED.sort_order;