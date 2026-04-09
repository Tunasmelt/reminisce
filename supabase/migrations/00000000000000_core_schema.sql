-- Originally: 00000000000000_init.sql | Feature: core schema
-- Users table is managed by Supabase Auth (auth.users)

CREATE TABLE public.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  repo_url text,
  tech_stack text[],
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.phases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  order_index integer NOT NULL,
  status text DEFAULT 'planned',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id uuid NOT NULL REFERENCES public.phases(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  status text DEFAULT 'planned',
  type text DEFAULT 'frontend',
  assigned_model text,
  priority integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_id uuid NOT NULL REFERENCES public.features(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status text DEFAULT 'pending',
  complexity integer,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.contexts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  content text,
  version integer DEFAULT 1,
  last_modified timestamptz DEFAULT now()
);

CREATE TABLE public.context_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  context_id uuid NOT NULL REFERENCES public.contexts(id) ON DELETE CASCADE,
  content text,
  diff text,
  changed_at timestamptz DEFAULT now()
);

CREATE TABLE public.prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  feature_id uuid REFERENCES public.features(id) ON DELETE SET NULL,
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  raw_prompt text,
  structured_prompt text,
  prompt_type text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  feature_id uuid REFERENCES public.features(id) ON DELETE SET NULL,
  prompt_id uuid REFERENCES public.prompts(id) ON DELETE SET NULL,
  model text,
  context_snapshot text,
  response text,
  tokens_used integer,
  status text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.wizard_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  messages jsonb DEFAULT '[]'::jsonb,
  architecture jsonb DEFAULT '{}'::jsonb,
  workflow jsonb DEFAULT '{}'::jsonb,
  status text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  message text NOT NULL,
  type text,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.graph_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  type text,
  label text,
  status text,
  position_x float,
  position_y float,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.graph_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  source_id uuid NOT NULL /* REFERENCES public.graph_nodes(id) ON DELETE CASCADE */,
  target_id uuid NOT NULL /* REFERENCES public.graph_nodes(id) ON DELETE CASCADE */,
  edge_type text,
  created_at timestamptz DEFAULT now()
);

-- RLS Setup
-- Enable RLS
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.context_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wizard_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.graph_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.graph_edges ENABLE ROW LEVEL SECURITY;

-- Workspaces Policies
CREATE POLICY "Users can view workspaces they own" ON public.workspaces
  FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Users can insert workspaces they own" ON public.workspaces
  FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Users can update workspaces they own" ON public.workspaces
  FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Users can delete workspaces they own" ON public.workspaces
  FOR DELETE USING (auth.uid() = owner_id);

-- Wait, the other tables depend on workspace or project, so let's simplify and check owner_id via joins
-- Since Supabase RLS with joins can be slow, a quick option is letting users manage everything but restricting at the app level, 
-- but the prompt explicitly said "RLS policies ensuring users only access their own workspace data."
-- Here we'll do basic auth checks and rely on joins or project matching.

CREATE POLICY "Users can manage projects in their workspaces" ON public.projects
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      WHERE w.id = workspace_id AND w.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage phases in their projects" ON public.phases
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.workspaces w ON p.workspace_id = w.id
      WHERE p.id = project_id AND w.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage features in their projects" ON public.features
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.workspaces w ON p.workspace_id = w.id
      WHERE p.id = project_id AND w.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage tasks in their projects" ON public.tasks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.features f
      JOIN public.projects p ON f.project_id = p.id
      JOIN public.workspaces w ON p.workspace_id = w.id
      WHERE f.id = feature_id AND w.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage contexts in their projects" ON public.contexts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.workspaces w ON p.workspace_id = w.id
      WHERE p.id = project_id AND w.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage context_versions in their projects" ON public.context_versions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.contexts c
      JOIN public.projects p ON c.project_id = p.id
      JOIN public.workspaces w ON p.workspace_id = w.id
      WHERE c.id = context_id AND w.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage prompts in their projects" ON public.prompts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.workspaces w ON p.workspace_id = w.id
      WHERE p.id = project_id AND w.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage agent_runs in their projects" ON public.agent_runs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.workspaces w ON p.workspace_id = w.id
      WHERE p.id = project_id AND w.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage wizard_sessions in their projects" ON public.wizard_sessions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.workspaces w ON p.workspace_id = w.id
      WHERE p.id = project_id AND w.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their notifications" ON public.notifications
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage graph_nodes in their projects" ON public.graph_nodes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.workspaces w ON p.workspace_id = w.id
      WHERE p.id = project_id AND w.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage graph_edges in their projects" ON public.graph_edges
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.workspaces w ON p.workspace_id = w.id
      WHERE p.id = project_id AND w.owner_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS public.user_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  provider text NOT NULL,
  encrypted_key text NOT NULL,
  label text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, provider)
);

ALTER TABLE public.user_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own keys" 
ON public.user_api_keys FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own keys" 
ON public.user_api_keys FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own keys" 
ON public.user_api_keys FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own keys" 
ON public.user_api_keys FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.provider_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  model_id text NOT NULL,
  model_name text NOT NULL,
  is_free boolean DEFAULT false,
  context_window integer,
  UNIQUE(provider, model_id)
);

-- Seed Provider Models
INSERT INTO public.provider_models (provider, model_id, model_name, is_free) VALUES
('openrouter', 'mistralai/mistral-small-3.1-24b-instruct:free', 'Mistral Small 3.1 (Free)', true),
('openrouter', 'google/gemini-2.0-flash-lite:free', 'Gemini 2.0 Flash Lite (Free)', true),
('openrouter', 'meta-llama/llama-3.3-70b-instruct:free', 'Llama 3.3 70B (Free)', true),
('openrouter', 'anthropic/claude-3.5-sonnet', 'Claude 3.5 Sonnet', false),
('openrouter', 'openai/gpt-4o', 'GPT-4o', false),
('openrouter', 'google/gemini-2.5-pro-preview-03-25', 'Gemini 2.5 Pro', false),
('mistral', 'mistral-large-latest', 'Mistral Large', false),
('mistral', 'mistral-small-latest', 'Mistral Small', true),
('mistral', 'codestral-latest', 'Codestral', false),
('gemini', 'gemini-2.0-flash', 'Gemini 2.0 Flash', true),
('gemini', 'gemini-2.5-pro-preview-03-25', 'Gemini 2.5 Pro', false),
('minimax', 'minimax-text-01', 'MiniMax Text 01', false),
('minimax', 'abab6.5s-chat', 'MiniMax ABAB 6.5S', true)
ON CONFLICT (provider, model_id) DO UPDATE SET model_name = EXCLUDED.model_name, is_free = EXCLUDED.is_free;

ALTER TABLE public.provider_models ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view provider models" 
ON public.provider_models FOR SELECT USING (true);
