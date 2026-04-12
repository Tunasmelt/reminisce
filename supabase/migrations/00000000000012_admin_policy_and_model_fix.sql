-- ============================================================
-- Migration 12: Admin Policy and Model Data Fixes
-- Replaces conflicting audit log policies and ensures 
-- provider_models has all required production columns.
-- ============================================================

-- Drop the conflicting policies
DROP POLICY IF EXISTS "Service role only" ON public.admin_logs;
DROP POLICY IF EXISTS "Admins can manage admin_logs" ON public.admin_logs;

-- Create a clean policy: only admins can read/write, service role bypasses anyway
CREATE POLICY "Admin users can read logs"
  ON public.admin_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_plans
      WHERE user_id = auth.uid() AND is_admin = true
    )
  );

-- Service role (used by API routes) bypasses RLS entirely,
-- so INSERTs from API routes always work regardless of this policy.
-- This SELECT policy allows admin users to read logs if they ever
-- query directly, and doesn't block the API routes.

-- Verify admin_logs has all needed columns (re-verified for safety)
ALTER TABLE public.admin_logs
  ADD COLUMN IF NOT EXISTS target_id   text,
  ADD COLUMN IF NOT EXISTS target_type text,
  ADD COLUMN IF NOT EXISTS payload     jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS target_user uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS details     jsonb DEFAULT '{}';

-- Verify provider_models has all needed columns  
ALTER TABLE public.provider_models
  ADD COLUMN IF NOT EXISTS label          text,
  ADD COLUMN IF NOT EXISTS enabled        boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS tier_required  text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS cost_coins     integer,
  ADD COLUMN IF NOT EXISTS cost_gems      integer,
  ADD COLUMN IF NOT EXISTS sort_order     integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes          text;

-- Backfill label from model_name
UPDATE public.provider_models SET label = model_name WHERE label IS NULL;

-- VERIFICATION (Run in Supabase SQL Editor):
-- Check admin_logs policy is correct
SELECT policyname, cmd FROM pg_policies
WHERE tablename = 'admin_logs';
-- Expected: "Admin users can read logs" | SELECT

-- Set your admin account if not already done
UPDATE public.user_plans
  SET is_admin = true
  WHERE user_id = 'c8152b0c-5182-4e8b-8c7f-3b689902ccd6';

-- Verify
SELECT user_id, plan, is_admin FROM public.user_plans
WHERE user_id = 'c8152b0c-5182-4e8b-8c7f-3b689902ccd6';
