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

-- Run in Supabase SQL editor before deploying to Vercel.
