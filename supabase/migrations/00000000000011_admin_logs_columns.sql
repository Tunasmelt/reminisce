-- ============================================================
-- Migration 11: admin_logs column consolidation
-- Adds missing columns so both migration paths work correctly.
-- Safe to run multiple times (IF NOT EXISTS throughout)
-- ============================================================

ALTER TABLE public.admin_logs
  ADD COLUMN IF NOT EXISTS target_id   text,
  ADD COLUMN IF NOT EXISTS target_type text,
  ADD COLUMN IF NOT EXISTS payload     jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS target_user uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS details     jsonb DEFAULT '{}';

-- VERIFICATION (Run in Supabase SQL Editor):
-- Check admin_logs has all columns
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'admin_logs'
ORDER BY ordinal_position;
-- Expected: id, admin_id, action, created_at, target_id, target_type,
--           payload, target_user, details
