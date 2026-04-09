-- Originally: 00000000000009_init.sql | Feature: admin and models
-- ══════════════════════════════════════════════════════════════════
-- Migration 10: Admin system + enhanced provider_models
-- Run this entire block in Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════════════════════════════

-- 1. Add admin/ban columns to user_plans
ALTER TABLE public.user_plans
  ADD COLUMN IF NOT EXISTS is_admin      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS banned_at     timestamptz,
  ADD COLUMN IF NOT EXISTS ban_reason    text,
  ADD COLUMN IF NOT EXISTS notes         text;

-- 2. Enhance provider_models for dynamic admin management
ALTER TABLE public.provider_models
  ADD COLUMN IF NOT EXISTS label          text,
  ADD COLUMN IF NOT EXISTS enabled        boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS tier_required  text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS cost_coins     integer,
  ADD COLUMN IF NOT EXISTS cost_gems      integer,
  ADD COLUMN IF NOT EXISTS sort_order     integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes          text;

-- Backfill label from model_name
UPDATE public.provider_models
  SET label = model_name
  WHERE label IS NULL;

-- Sync tier_required from is_free
UPDATE public.provider_models
  SET tier_required = CASE WHEN is_free THEN 'free' ELSE 'pro' END
  WHERE tier_required = 'free' AND is_free = false;

-- 3. Admin audit log
CREATE TABLE IF NOT EXISTS public.admin_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    uuid NOT NULL REFERENCES auth.users(id),
  action      text NOT NULL,
  target_id   text,
  target_type text,
  payload     jsonb DEFAULT '{}'::jsonb,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only" ON public.admin_logs
  FOR ALL USING (false);

-- 4. Grant your account admin access
UPDATE public.user_plans
  SET is_admin = true
  WHERE user_id = 'c8152b0c-5182-4e8b-8c7f-3b689902ccd6';

-- 5. Verify
SELECT id, is_admin, banned_at FROM public.user_plans
  WHERE user_id = 'c8152b0c-5182-4e8b-8c7f-3b689902ccd6';