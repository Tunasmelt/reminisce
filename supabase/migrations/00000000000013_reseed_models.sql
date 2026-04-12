-- ============================================================
-- Migration 13: Model Reseed
-- Clears and reseeds provider_models with a verified list
-- of Free and Pro tier models.
-- ============================================================

-- First ensure columns exist (safe to run again)
ALTER TABLE public.provider_models
  ADD COLUMN IF NOT EXISTS label         text,
  ADD COLUMN IF NOT EXISTS enabled       boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS tier_required text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS sort_order    integer NOT NULL DEFAULT 0;

-- Clear and reseed
DELETE FROM public.provider_models;

INSERT INTO public.provider_models
  (provider, model_id, model_name, label, is_free, enabled, tier_required, sort_order)
VALUES
  ('groq','llama-3.1-8b-instant','Llama 3.1 8B','Llama 3.1 8B ⚡',true,true,'free',1),
  ('groq','llama-3.3-70b-versatile','Llama 3.3 70B','Llama 3.3 70B',true,true,'free',2),
  ('groq','gemma2-9b-it','Gemma 2 9B','Gemma 2 9B',true,true,'free',3),
  ('groq','llama-3.2-3b-preview','Llama 3.2 3B','Llama 3.2 3B ⚡',true,true,'free',4),
  ('cerebras','llama3.1-8b','Llama 3.1 8B','Llama 3.1 8B (Cerebras) ⚡',true,true,'free',10),
  ('cerebras','llama-3.3-70b','Llama 3.3 70B','Llama 3.3 70B (Cerebras)',true,true,'free',11),
  ('gemini','gemini-2.0-flash','Gemini 2.0 Flash','Gemini 2.0 Flash',true,true,'free',20),
  ('gemini','gemini-1.5-flash','Gemini 1.5 Flash','Gemini 1.5 Flash',true,true,'free',21),
  ('gemini','gemini-1.5-flash-8b','Gemini 1.5 Flash 8B','Gemini 1.5 Flash 8B ⚡',true,true,'free',22),
  ('mistral','open-mistral-7b','Mistral 7B','Mistral 7B',true,true,'free',30),
  ('mistral','mistral-small-latest','Mistral Small','Mistral Small',true,true,'free',31),
  ('openrouter','meta-llama/llama-3.3-70b-instruct:free','Llama 3.3 70B OR','Llama 3.3 70B (OR)',true,true,'free',40),
  ('openrouter','meta-llama/llama-3.1-8b-instruct:free','Llama 3.1 8B OR','Llama 3.1 8B (OR) ⚡',true,true,'free',41),
  ('openrouter','mistralai/mistral-7b-instruct:free','Mistral 7B OR','Mistral 7B (OR)',true,true,'free',42),
  ('openrouter','qwen/qwen-2.5-72b-instruct:free','Qwen 2.5 72B','Qwen 2.5 72B',true,true,'free',43),
  ('openrouter','google/gemma-3-12b-it:free','Gemma 3 12B','Gemma 3 12B',true,true,'free',44),
  ('openrouter','microsoft/phi-3-mini-128k-instruct:free','Phi-3 Mini','Phi-3 Mini ⚡',true,true,'free',45),
  ('anthropic','claude-3-5-haiku-20241022','Claude 3.5 Haiku','Claude 3.5 Haiku',false,true,'pro',100),
  ('anthropic','claude-sonnet-4-20250514','Claude Sonnet 4','Claude Sonnet 4',false,true,'pro',101),
  ('openai','gpt-4o-mini','GPT-4o Mini','GPT-4o Mini',false,true,'pro',110),
  ('openai','gpt-4o','GPT-4o','GPT-4o',false,true,'pro',111),
  ('gemini','gemini-2.5-flash','Gemini 2.5 Flash','Gemini 2.5 Flash',false,true,'pro',120),
  ('gemini','gemini-2.5-pro','Gemini 2.5 Pro','Gemini 2.5 Pro',false,true,'pro',121),
  ('mistral','mistral-large-latest','Mistral Large','Mistral Large',false,true,'pro',130),
  ('mistral','codestral-latest','Codestral','Codestral',false,true,'pro',131);
