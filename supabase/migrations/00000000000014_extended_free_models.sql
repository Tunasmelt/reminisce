-- ============================================================
-- Migration 14: Extended Free Tier Models
-- Adds high-performance niche models to the free tier
-- ============================================================

INSERT INTO public.provider_models 
  (provider, model_id, model_name, label, is_free, enabled, tier_required, sort_order)
VALUES
  -- Groq specialized
  ('groq', 'mixtral-8x7b-32768', 'Mixtral 8x7B', 'Mixtral 8x7B (Large Context)', true, true, 'free', 5),
  ('groq', 'qwen-2.5-coder-32b', 'Qwen 2.5 Coder', 'Qwen 2.5 Coder (Technical) ⚡', true, true, 'free', 10),
  
  -- Google Flash-Lite
  ('gemini', 'gemini-1.5-flash-lite', 'Gemini Flash Lite', 'Gemini Flash Lite ⚡', true, true, 'free', 25),
  
  -- OpenRouter Premium Free
  ('openrouter', 'deepseek/deepseek-chat:free', 'DeepSeek-V3', 'DeepSeek-V3 (Smart)', true, true, 'free', 46),
  ('openrouter', 'nousresearch/hermes-3-llama-3.1-405b:free', 'Llama 3.1 405B', 'Llama 3.1 405B (Heavyweight)', true, true, 'free', 47),
  ('openrouter', 'liquid/lfm-40b:free', 'Liquid LFM 40B', 'Liquid LFM 40B ⚡', true, true, 'free', 48)
ON CONFLICT (provider, model_id) DO NOTHING;

-- VERIFICATION (Run in Supabase SQL Editor):
-- Check provider_models row count and columns
SELECT COUNT(*) as model_count FROM public.provider_models;
-- Expected: 25+ rows

SELECT provider, model_id, label, enabled, tier_required, sort_order
FROM public.provider_models
ORDER BY sort_order
LIMIT 5;
-- Expected: first rows are groq models with sort_order 1-4
