-- ============================================================
-- REMINISCE V2 — SUPABASE SCHEMA PATCH
-- Run this entire script in Supabase → SQL Editor
-- Safe to run multiple times (uses IF NOT EXISTS / DO blocks)
-- ============================================================


-- ============================================================
-- 1. USER_PLANS
-- Referenced by: wallet.ts, keys/save/route.ts,
--                stripe/checkout/route.ts, stripe/webhook/route.ts
-- Not in original migration at all.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_plans (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan                  text NOT NULL DEFAULT 'free',         -- 'free' | 'pro'
  status                text NOT NULL DEFAULT 'active',       -- 'active' | 'cancelled'
  projects_limit        integer NOT NULL DEFAULT 2,
  stripe_customer_id    text,
  stripe_subscription_id text,
  updated_at            timestamptz DEFAULT now(),
  created_at            timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.user_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own plan"
  ON public.user_plans FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage plans"
  ON public.user_plans FOR ALL
  USING (true)
  WITH CHECK (true);


-- ============================================================
-- 2. USER_WALLETS
-- Referenced by: wallet.ts, stripe/webhook/route.ts
-- Not in original migration at all.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_wallets (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gems                integer NOT NULL DEFAULT 0,
  coins               integer NOT NULL DEFAULT 50,
  coins_last_reset    timestamptz,
  daily_coins_limit   integer NOT NULL DEFAULT 50,
  max_coins_banked    integer NOT NULL DEFAULT 200,
  gems_monthly_grant  integer NOT NULL DEFAULT 0,
  updated_at          timestamptz DEFAULT now(),
  created_at          timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.user_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own wallet"
  ON public.user_wallets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage wallets"
  ON public.user_wallets FOR ALL
  USING (true)
  WITH CHECK (true);


-- ============================================================
-- 3. WALLET_TRANSACTIONS
-- Referenced by: wallet.ts (deductCost, refundCost,
--                applyDailyReset, awardCoins)
-- Not in original migration at all.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type                text NOT NULL,           -- 'debit' | 'credit' | 'refund'
  amount              integer NOT NULL,
  currency            text NOT NULL,           -- 'coins' | 'gems'
  model_used          text,
  run_id              uuid,
  description         text,
  transaction_source  text,                   -- 'run' | 'refund' | 'daily_reset' | 'wizard_complete' | etc
  metadata            jsonb DEFAULT '{}'::jsonb,
  created_at          timestamptz DEFAULT now()
);

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own transactions"
  ON public.wallet_transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage transactions"
  ON public.wallet_transactions FOR ALL
  USING (true)
  WITH CHECK (true);


-- ============================================================
-- 4. GEM_PURCHASES
-- Referenced by: stripe/webhook/route.ts
-- Not in original migration at all.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.gem_purchases (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_gems               integer NOT NULL,
  amount_paid_cents         integer NOT NULL,
  stripe_payment_intent_id  text,
  status                    text NOT NULL DEFAULT 'pending',  -- 'pending' | 'complete'
  created_at                timestamptz DEFAULT now()
);

ALTER TABLE public.gem_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own gem purchases"
  ON public.gem_purchases FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage gem purchases"
  ON public.gem_purchases FOR ALL
  USING (true)
  WITH CHECK (true);


-- ============================================================
-- 5. AGENT_RUNS — alter existing table
-- Migration has:  model, context_snapshot, response, tokens_used
-- Code uses:      model_used, prompt_used, started_at, output,
--                 completed_at, error_message
-- These are renamed/additional columns the code expects.
-- ============================================================

ALTER TABLE public.agent_runs
  ADD COLUMN IF NOT EXISTS model_used      text,
  ADD COLUMN IF NOT EXISTS prompt_used     text,
  ADD COLUMN IF NOT EXISTS output          text,
  ADD COLUMN IF NOT EXISTS started_at      timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at    timestamptz,
  ADD COLUMN IF NOT EXISTS error_message   text;


-- ============================================================
-- 6. CONTEXT_VERSIONS — alter existing table
-- Migration has:  context_id, content, diff, changed_at
-- Code uses:      project_id (for direct filtering),
--                 sha (for display/diffing),
--                 label (for named snapshots),
--                 created_at (dashboard orders by this)
-- ============================================================

ALTER TABLE public.context_versions
  ADD COLUMN IF NOT EXISTS project_id  uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS sha         text,
  ADD COLUMN IF NOT EXISTS label       text,
  ADD COLUMN IF NOT EXISTS created_at  timestamptz DEFAULT now();

-- Index for the project_id filter used in dashboard
CREATE INDEX IF NOT EXISTS idx_context_versions_project_id
  ON public.context_versions(project_id);


-- ============================================================
-- 7. PROVIDER_MODELS — update seed data
-- Original seed has dead models (gemini-2.0-flash-exp, gpt-4o).
-- Replace with current model set matching wallet.ts MODEL_COSTS.
-- ============================================================

-- Remove dead/removed entries
DELETE FROM public.provider_models
  WHERE (provider = 'openrouter' AND model_id = 'google/gemini-2.0-flash-exp:free')
     OR (provider = 'openrouter' AND model_id = 'openai/gpt-4o')
     OR (provider = 'openrouter' AND model_id = 'anthropic/claude-3.5-sonnet')
     OR (provider = 'openrouter' AND model_id = 'google/gemini-2.5-pro-preview-03-25')
     OR (provider = 'gemini'     AND model_id = 'gemini-2.5-pro-preview-03-25');

-- Upsert current correct model set
INSERT INTO public.provider_models (provider, model_id, model_name, is_free) VALUES
  -- Free tier OpenRouter models
  ('openrouter', 'meta-llama/llama-3.3-70b-instruct:free',         'Llama 3.3 70B',          true),
  ('openrouter', 'mistralai/mistral-7b-instruct:free',              'Mistral 7B',              true),
  ('openrouter', 'mistralai/mistral-small-3.1-24b-instruct:free',   'Mistral Small 3.1',       true),
  ('openrouter', 'nvidia/llama-3.3-nemotron-super-49b-v1:free',     'Nemotron Super 49B',      true),
  ('openrouter', 'nvidia/llama-nemotron-nano-8b-instruct:free',     'Nemotron Nano 8B',        true),
  ('openrouter', 'google/gemma-3-27b-it:free',                      'Gemma 3 27B',             true),
  ('openrouter', 'deepseek/deepseek-r1:free',                       'DeepSeek R1',             true),
  -- Pro tier direct API models
  ('mistral',    'mistral-small-latest',                            'Mistral Small',           false),
  ('mistral',    'mistral-large-latest',                            'Mistral Large',           false),
  ('anthropic',  'claude-sonnet-4-20250514',                        'Claude Sonnet',           false),
  ('gemini',     'gemini-2.0-flash',                                'Gemini 2.0 Flash',        false)
ON CONFLICT (provider, model_id)
  DO UPDATE SET model_name = EXCLUDED.model_name, is_free = EXCLUDED.is_free;


-- ============================================================
-- 8. AUTO-PROVISION user_plans + user_wallets on signup
-- Without this, new users have no plan or wallet row and
-- every wallet/plan lookup returns null, falling back to
-- defaults in code but never persisting anything.
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create free plan
  INSERT INTO public.user_plans (user_id, plan, status, projects_limit)
  VALUES (NEW.id, 'free', 'active', 2)
  ON CONFLICT (user_id) DO NOTHING;

  -- Create wallet with free tier defaults
  INSERT INTO public.user_wallets (
    user_id, gems, coins,
    daily_coins_limit, max_coins_banked, gems_monthly_grant
  )
  VALUES (NEW.id, 0, 50, 50, 200, 0)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Attach trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- 9. BACKFILL existing users who signed up before this script
-- Creates missing plan/wallet rows for anyone already in the DB.
-- ============================================================

INSERT INTO public.user_plans (user_id, plan, status, projects_limit)
SELECT id, 'free', 'active', 2
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_wallets (
  user_id, gems, coins,
  daily_coins_limit, max_coins_banked, gems_monthly_grant
)
SELECT id, 0, 50, 50, 200, 0
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;


-- ============================================================
-- DONE. Verify by running:
--   SELECT * FROM public.user_plans LIMIT 5;
--   SELECT * FROM public.user_wallets LIMIT 5;
--   SELECT column_name FROM information_schema.columns
--     WHERE table_name = 'agent_runs';
--   SELECT column_name FROM information_schema.columns
--     WHERE table_name = 'context_versions';
-- ============================================================