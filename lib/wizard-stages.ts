import type { AIProvider } from '@/lib/ai-client'

// ─────────────────────────────────────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────────────────────────────────────

export type WizardStageKey =
  | 'idea'
  | 'features'
  | 'stack'
  | 'generating'
  | 'complete'

export interface WizardStageMeta {
  key: WizardStageKey
  label: string
  shortLabel: string
  description: string
  readySignal: string
}

export interface ConfirmedFeature {
  name: string
  description: string
  type: 'frontend' | 'backend' | 'database' | 'testing' | 'architecture'
  priority: 'core' | 'nice-to-have' | 'future'
  confirmed: boolean
}

export interface TechStackOption {
  id: 'A' | 'B' | 'C'
  label: string
  tag: string
  complexity: 'simple' | 'standard' | 'scalable'
  frontend: string
  backend: string
  database: string
  hosting: string
  other: string
  pros: string[]
  cons: string[]
  bestFor: string
}

export interface WizardSessionState {
  stage: WizardStageKey
  stage_data: Record<string, unknown>
  completed_stages: WizardStageKey[]
  confirmed_idea: string | null
  confirmed_features: ConfirmedFeature[]
  selected_stack: TechStackOption | null
  stack_options: TechStackOption[]
  generation_status: 'idle' | 'generating' | 'complete' | 'failed' | 'partial'
  generation_step: number
  last_error: string | null
}

export interface WizardContext {
  projectName: string
  confirmedIdea?: string | null
  confirmedFeatures?: ConfirmedFeature[]
  selectedStack?: TechStackOption | null
  userMentionedStack?: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
//  Stage ordering and metadata
// ─────────────────────────────────────────────────────────────────────────────

export const STAGE_ORDER: WizardStageKey[] = [
  'idea',
  'features',
  'stack',
  'generating',
  'complete',
]

export const STAGE_META: Record<WizardStageKey, WizardStageMeta> = {
  idea: {
    key: 'idea',
    label: 'Idea Expansion',
    shortLabel: 'Idea',
    description: 'Describe your project — one message is enough. Paste from ChatGPT or Gemini, or just tell me the idea.',
    readySignal: '[IDEA_CONFIRMED]',
  },
  features: {
    key: 'features',
    label: 'Feature Set',
    shortLabel: 'Features',
    description: 'Review and confirm the features. Edit, reorder, or untick anything before continuing.',
    readySignal: '[FEATURES_CONFIRMED]',
  },
  stack: {
    key: 'stack',
    label: 'Tech Stack',
    shortLabel: 'Stack',
    description: 'Choose a tech stack from 3 tailored options.',
    readySignal: '[STACK_SELECTED]',
  },
  generating: {
    key: 'generating',
    label: 'Generating Blueprint',
    shortLabel: 'Generating',
    description: 'Building your complete project blueprint...',
    readySignal: '[GENERATION_COMPLETE]',
  },
  complete: {
    key: 'complete',
    label: 'Blueprint Ready',
    shortLabel: 'Complete',
    description: 'Your blueprint has been saved. Head to Graph or Board to start building.',
    readySignal: '',
  },
}

// ─────────────────────────────────────────────────────────────────────────────
//  Generation sub-steps
// ─────────────────────────────────────────────────────────────────────────────

export interface GenerationStep {
  index: number
  label: string
  description: string
  wave: 1 | 2 | 3  // Wave the step belongs to for parallel execution display
}

export const GENERATION_STEPS: GenerationStep[] = [
  {
    index: 0,
    label: 'Architecture & Context',
    description: 'Designing system architecture and writing context files...',
    wave: 1,
  },
  {
    index: 1,
    label: 'Phases & Features',
    description: 'Breaking the project into development phases...',
    wave: 1,
  },
  {
    index: 2,
    label: 'Feature Prompts',
    description: 'Generating build prompts for each feature...',
    wave: 2,
  },
  {
    index: 3,
    label: 'Phase Prompts',
    description: 'Generating phase kickoff prompts...',
    wave: 2,
  },
  {
    index: 4,
    label: 'Master Prompt',
    description: 'Compiling the master context prompt and editor files...',
    wave: 3,
  },
]

// ─────────────────────────────────────────────────────────────────────────────
//  Stage navigation helpers
// ─────────────────────────────────────────────────────────────────────────────

export function getNextStage(current: WizardStageKey): WizardStageKey | null {
  const idx = STAGE_ORDER.indexOf(current)
  if (idx === -1 || idx >= STAGE_ORDER.length - 1) return null
  return STAGE_ORDER[idx + 1]
}

export function getPrevStage(current: WizardStageKey): WizardStageKey | null {
  const idx = STAGE_ORDER.indexOf(current)
  if (idx <= 0) return null
  return STAGE_ORDER[idx - 1]
}

export function getStageIndex(stage: WizardStageKey): number {
  return STAGE_ORDER.indexOf(stage)
}

export function isStageComplete(
  stage: WizardStageKey,
  completedStages: WizardStageKey[],
): boolean {
  return completedStages.includes(stage)
}

// ─────────────────────────────────────────────────────────────────────────────
//  Signal detection
// ─────────────────────────────────────────────────────────────────────────────

export function detectStageSignal(content: string): WizardStageKey | null {
  if (content.includes('[IDEA_CONFIRMED]'))     return 'features'
  if (content.includes('[FEATURES_CONFIRMED]')) return 'stack'
  if (content.includes('[STACK_SELECTED]'))     return 'generating'
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
//  Signal stripping — server-side before any text reaches the client
// ─────────────────────────────────────────────────────────────────────────────

export function stripSignals(content: string): string {
  let result = content

  // Strip JSON data blocks — must come before simple token stripping
  result = result
    .replace(/\[IDEA_JSON\][\s\S]*?\[\/IDEA_JSON\]/g, '')
    .replace(/\[FEATURES_JSON\][\s\S]*?\[\/FEATURES_JSON\]/g, '')
    .replace(/\[STACKS_JSON\][\s\S]*?\[\/STACKS_JSON\]/g, '')

  // Strip simple signal tokens
  result = result
    .replace(/\[IDEA_CONFIRMED\]/g, '')
    .replace(/\[FEATURES_CONFIRMED\]/g, '')
    .replace(/\[STACK_SELECTED:[ABC]\]/g, '')
    .replace(/\[STACK_SELECTED\]/g, '')
    .replace(/\[GENERATION_COMPLETE\]/g, '')

  // Strip partial/incomplete blocks still mid-stream
  const openTags = [
    '[IDEA_JSON]',
    '[FEATURES_JSON]',
    '[STACKS_JSON]',
  ]
  for (const tag of openTags) {
    const openIdx = result.lastIndexOf(tag)
    if (openIdx !== -1) {
      const closeTag = tag.replace('[', '[/')
      if (!result.includes(closeTag, openIdx)) {
        result = result.slice(0, openIdx)
      }
    }
  }

  return result.trim()
}

// ─────────────────────────────────────────────────────────────────────────────
//  Data extractors — parse structured JSON from AI responses
//  These run server-side only. The extracted data is saved to
//  wizard_sessions but the raw JSON never reaches the client stream.
// ─────────────────────────────────────────────────────────────────────────────

export function extractIdeaData(content: string): {
  summary: string
  problemStatement: string
  coreValue: string
} | null {
  const match = content.match(/\[IDEA_JSON\]([\s\S]*?)\[\/IDEA_JSON\]/)
  if (!match) return null
  try {
    return JSON.parse(match[1].trim())
  } catch {
    return null
  }
}

export function extractFeaturesData(
  content: string,
): ConfirmedFeature[] | null {
  const match = content.match(/\[FEATURES_JSON\]([\s\S]*?)\[\/FEATURES_JSON\]/)
  if (!match) return null
  try {
    const parsed = JSON.parse(match[1].trim())
    if (!Array.isArray(parsed)) return null
    return parsed as ConfirmedFeature[]
  } catch {
    return null
  }
}

export function extractStackOptions(
  content: string,
): TechStackOption[] | null {
  const match = content.match(/\[STACKS_JSON\]([\s\S]*?)\[\/STACKS_JSON\]/)
  if (!match) return null
  try {
    const parsed = JSON.parse(match[1].trim())
    if (!Array.isArray(parsed)) return null
    return parsed as TechStackOption[]
  } catch {
    return null
  }
}

export function extractSelectedStackId(
  content: string,
): 'A' | 'B' | 'C' | null {
  const match = content.match(/\[STACK_SELECTED:([ABC])\]/)
  if (!match) return null
  return match[1] as 'A' | 'B' | 'C'
}

// ─────────────────────────────────────────────────────────────────────────────
//  System prompts
// ─────────────────────────────────────────────────────────────────────────────

export function getSystemPrompt(
  stage: WizardStageKey,
  ctx: WizardContext,
): string {
  const base = `You are Wizard — an expert AI project architect inside Reminisce, a developer platform for building AI-assisted software projects. You are precise, structured, and concise. You never pad responses unnecessarily. You never ask more than one question per response.`

  switch (stage) {

    // ── IDEA STAGE ──────────────────────────────────────────────────────────
    // The user's first message can be anything from one sentence to a full
    // spec pasted from another AI. Handle both in one exchange.
    case 'idea':
      return `${base}

CURRENT STAGE: Idea Expansion
PROJECT NAME: ${ctx.projectName}

YOUR ROLE:
The user will describe their project idea. This may be:
  (A) A detailed input — long message, structured, mentions features or tech stack,
      possibly pasted from ChatGPT, Gemini, Claude, or another AI tool.
  (B) A bare or vague idea — short, high-level, few specifics.

RULES:
1. Detect which type of input you received on the first message.

2. If input is TYPE A (detailed, 150+ words, OR mentions features/stack/tech):
   - Acknowledge it briefly (1-2 sentences max).
   - Immediately synthesise the complete picture: idea summary, features, 3 stacks.
   - Output everything in a single response. Do NOT ask any follow-up questions.

3. If input is TYPE B (bare/vague):
   - Ask exactly ONE focused question to understand the core problem or differentiator.
   - Keep your question to 1-2 sentences.
   - After the user's follow-up (regardless of length), synthesise immediately.
   - Never ask a second clarifying question. Synthesise on the second exchange no matter what.

4. When synthesising, your readable chat response should cover:
   - A 2-3 sentence project summary
   - The problem it solves
   - A brief list of proposed features (human-readable, not JSON)
   - A note that the user can review and edit features in the panel on the right
   - A brief mention of the 3 tech stack options they'll see on the right

5. At the end of your synthesis response, append these blocks in order.
   They will be stripped server-side — the user never sees them.

[IDEA_JSON]
{
  "summary": "2-3 sentence plain-English summary of the project",
  "problemStatement": "The specific problem this product solves",
  "coreValue": "What makes this product valuable or differentiated"
}
[/IDEA_JSON]

[FEATURES_JSON]
[
  {
    "name": "Feature Name — specific and actionable",
    "description": "What this feature does and why it matters. 1-2 sentences.",
    "type": "frontend|backend|database|testing|architecture",
    "priority": "core|nice-to-have|future",
    "confirmed": true
  }
]
[/FEATURES_JSON]

[STACKS_JSON]
[
  {
    "id": "A",
    "label": "Stack name",
    "tag": "Popular · Simple",
    "complexity": "simple",
    "frontend": "...",
    "backend": "...",
    "database": "...",
    "hosting": "...",
    "other": "...",
    "pros": ["Pro 1 specific to this project", "Pro 2", "Pro 3"],
    "cons": ["Con 1", "Con 2"],
    "bestFor": "Who this option suits best"
  },
  { "id": "B", "tag": "Popular · Flexible", "complexity": "standard", ... },
  { "id": "C", "tag": "Complex · Scalable", "complexity": "scalable", ... }
]
[/STACKS_JSON]

[IDEA_CONFIRMED]

FEATURE RULES:
- Minimum 6 features, maximum 18
- At least 3 must be "core" priority
- At least 1 must be "testing" type
- At least 1 must be "architecture" type
- If the user already listed features, include them verbatim and expand
- Be specific — "User Authentication with JWT" not just "Login"

STACK RULES:
- Option A: Popular & Simple — minimal moving parts, fastest to ship
- Option B: Popular & Flexible — standard industry stack, more control
- Option C: Scalable & Complex — designed for high traffic / large teams
- All 3 pros/cons must be specific to THIS project's features, not generic
- If the user mentioned a stack, make it Option A
${ctx.userMentionedStack ? `- User mentioned: "${ctx.userMentionedStack}" — incorporate as Option A` : ''}

IMPORTANT: Only append the JSON blocks and [IDEA_CONFIRMED] at the end of
a synthesis response. Do NOT append them if you are still asking a clarifying
question (TYPE B first exchange).`

    // ── FEATURES STAGE ──────────────────────────────────────────────────────
    // The features are now displayed as interactive cards in the right panel.
    // The user has edited them there. The chat is open for refinement only.
    case 'features':
      return `${base}

CURRENT STAGE: Feature Review
PROJECT NAME: ${ctx.projectName}
CONFIRMED IDEA: ${ctx.confirmedIdea || 'Not yet confirmed'}

YOUR ROLE:
The user is reviewing and editing features in the right panel.
The chat is available for them to request changes conversationally.

HOW TO RESPOND:
- If the user asks to add a feature: acknowledge it and remind them they can
  also add it directly in the panel using the "+ Add feature" button.
- If the user asks to remove or change a feature: acknowledge it and remind
  them they can edit directly in the panel.
- If the user asks a question about the project: answer it concisely.
- If the user says they're ready, happy, or wants to continue: tell them to
  click the "Confirm Features →" button in the right panel.

RULES:
- Keep responses short — 1-3 sentences max.
- Never re-list all the features. The panel shows them.
- Never output [FEATURES_JSON] or [FEATURES_CONFIRMED] — the UI handles
  feature confirmation when the user clicks the button.
- Do not auto-advance this stage. The user must click the confirm button.`

    // ── STACK STAGE ─────────────────────────────────────────────────────────
    // Stack options are shown as cards in the right panel.
    // Chat is available for questions only.
    case 'stack':
      return `${base}

CURRENT STAGE: Tech Stack Selection
PROJECT NAME: ${ctx.projectName}
CONFIRMED IDEA: ${ctx.confirmedIdea || 'Not confirmed'}
CONFIRMED FEATURES: ${
  ctx.confirmedFeatures && ctx.confirmedFeatures.length > 0
    ? ctx.confirmedFeatures.map(f => f.name).join(', ')
    : 'Not confirmed'
}
${ctx.userMentionedStack ? `USER MENTIONED: "${ctx.userMentionedStack}"` : ''}

YOUR ROLE:
Three tech stack options are shown as cards in the right panel.
The user clicks a card to select and then clicks "Generate Blueprint".
The chat is available for questions about the stacks only.

HOW TO RESPOND:
- If asked about a specific stack option: explain concisely.
- If the user expresses a preference: confirm it and tell them to click
  that option's card in the panel.
- If the user wants a custom combination: acknowledge it, explain the
  closest option, and tell them to select it — custom stacks can be
  refined after generation.
- Keep all responses to 2-4 sentences max.

RULES:
- Never output [STACKS_JSON] or [STACK_SELECTED] — the UI handles
  stack selection when the user clicks a card.
- Do not auto-advance this stage.`

    // ── GENERATING / COMPLETE ────────────────────────────────────────────────
    case 'generating':
    case 'complete':
      return `${base}

Blueprint generation is in progress or complete.
Only respond to direct questions about the project.
Keep responses under 3 sentences.`

    default:
      return base
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Generation prompts — used by generate/route.ts
// ─────────────────────────────────────────────────────────────────────────────

export interface GenerationContext {
  projectName: string
  confirmedIdea: string
  confirmedFeatures: ConfirmedFeature[]
  targetAudience: string      // kept for backward compat — may be empty string
  selectedStack: TechStackOption
  conversationSummary: string
  repoUrl?: string | null     // from projects.repo_url — injected into architecture prompt
  editorPreference?: string   // from projects.editor_preference — used in Step 4
}

export interface GenerationPromptSet {
  step: number
  label: string
  systemPrompt: string
  userPrompt: string
  outputKey: string
  wave: 1 | 2 | 3
  /** Max tokens for this step's AI call. Tuned per step to stay within
   *  Groq TPM limits and avoid over-generation. */
  maxTokens: number
  /** If set, use this model for this step instead of the user's selection. */
  lightModel?: { provider: string; model: string }
}

export function buildGenerationPrompts(
  ctx: GenerationContext,
): GenerationPromptSet[] {
  const stackSummary = `Frontend: ${ctx.selectedStack.frontend}
Backend:  ${ctx.selectedStack.backend}
Database: ${ctx.selectedStack.database}
Hosting:  ${ctx.selectedStack.hosting}
Other:    ${ctx.selectedStack.other}`.trim()

  const featuresSummary = ctx.confirmedFeatures
    .map(f => `- [${f.priority.toUpperCase()}] ${f.name} (${f.type}): ${f.description}`)
    .join('\n')

  const sharedContext = `PROJECT: ${ctx.projectName}
IDEA: ${ctx.confirmedIdea}
${ctx.targetAudience ? `TARGET AUDIENCE: ${ctx.targetAudience}` : ''}
${ctx.repoUrl ? `REPOSITORY: ${ctx.repoUrl}` : ''}
TECH STACK:
${stackSummary}
CONFIRMED FEATURES:
${featuresSummary}`.trim()

  // Editor integration file format spec — injected into Step 4 prompt
  const editorSpec = buildEditorSpec(ctx.editorPreference ?? 'generic', ctx.projectName)

  return [

    // ── STEP 0 — Architecture & Context Files (Wave 1) ───────────────────
    // Generates 4 core context files with REMINISCE:SUMMARY tags.
    // Token budget: 3000 — fits within Groq 70B TPM limits.
    // Files: architecture.md, tech-stack.md, coding-guidelines.md, product-scope.md
    {
      step: 0,
      label: 'Architecture & Context',
      outputKey: 'architecture_and_files',
      wave: 1,
      maxTokens: 3000,
      systemPrompt: `You are a senior software architect generating project context files for an AI-assisted development platform. Output ONLY valid JSON — no markdown fences, no text outside the JSON object.`,
      userPrompt: `${sharedContext}

Generate a JSON object with this exact structure:
{
  "architecture": "3-4 paragraph description of the system architecture: components, how they interact, key design decisions, data flow, and technical rationale.",
  "markdownFiles": {
    "reminisce/context/architecture.md": "<!-- REMINISCE:SUMMARY\\nOne paragraph describing what this file covers: system overview, component breakdown, and when to reference it. Use for: architecture decisions, component questions, data flow.\\nOWNED_BY: reminisce | LAST_UPDATED: AUTO\\n-->\\n# Architecture Overview\\n\\n[Full architecture markdown — system overview, components, data flow, key technical decisions. 150-200 words of real content.]",
    "reminisce/context/tech-stack.md": "<!-- REMINISCE:SUMMARY\\nOne paragraph covering the chosen stack and why. Reference when: adding dependencies, choosing libraries, setup questions.\\nOWNED_BY: reminisce | LAST_UPDATED: AUTO\\n-->\\n# Tech Stack\\n\\n[Why this stack, key versions, setup notes, tradeoffs vs alternatives. 100-150 words.]",
    "reminisce/context/coding-guidelines.md": "<!-- REMINISCE:SUMMARY\\nOne paragraph covering code style, folder structure, naming conventions. Reference when: creating files, naming things, following patterns.\\nOWNED_BY: reminisce | LAST_UPDATED: AUTO\\n-->\\n# Coding Guidelines\\n\\n[Folder structure, naming conventions, code style rules, patterns to follow and avoid. 100-150 words.]",
    "reminisce/context/product-scope.md": "<!-- REMINISCE:SUMMARY\\nOne paragraph covering v1 scope boundaries. Reference when: deciding what to build, evaluating new feature requests, scope questions.\\nOWNED_BY: reminisce | LAST_UPDATED: AUTO\\n-->\\n# Product Scope\\n\\n[What is in scope for v1, what is explicitly out of scope, success metrics, v2 ideas. 100-150 words.]"
  }
}

RULES:
- Every file must include the <!-- REMINISCE:SUMMARY ... --> block at the top, exactly as shown
- Replace [placeholder text] with real content specific to this project and stack
- File paths must start with reminisce/ exactly as shown
- Keep each file 100-200 words of actual content — concise but complete
- Do not add extra files beyond the four specified
- Output ONLY the JSON object`,
    },

    // ── STEP 1 — Phases & Features (Wave 1, parallel with Step 0) ────────
    {
      step: 1,
      label: 'Phases & Features',
      outputKey: 'phases',
      wave: 1,
      maxTokens: 4000,
      systemPrompt: `You are a technical project manager. Break the project into development phases with features. Output ONLY valid JSON.`,
      userPrompt: `${sharedContext}

Generate a JSON object:
{
  "phases": [
    {
      "name": "Phase name (e.g. Foundation, Core Features, Polish)",
      "description": "What this phase delivers and why it comes first. 2-3 sentences.",
      "order_index": 0,
      "estimatedWeeks": 2,
      "features": [
        {
          "name": "Feature name — specific and actionable",
          "description": "What this feature does technically and what the user experiences. 2 sentences minimum.",
          "type": "frontend|backend|database|testing|architecture",
          "priority": "core|nice-to-have|future",
          "acceptanceCriteria": ["Testable condition 1", "Testable condition 2", "Testable condition 3"]
        }
      ]
    }
  ],
  "agentAssignments": {
    "Feature Name": "llama-3.1-8b-instant"
  }
}

RULES:
- Minimum 3 phases, maximum 6
- Phase 1 must contain only 'core' priority features
- Every feature from the confirmed list must appear in exactly one phase
- agentAssignments: use "llama-3.1-8b-instant" for frontend/testing, "llama-3.3-70b-versatile" for backend/architecture
- Minimum 3 acceptance criteria per feature, written as testable conditions
- Output ONLY the JSON object`,
    },

    // ── STEP 2 — Feature Prompts (Wave 2) ────────────────────────────────
    {
      step: 2,
      label: 'Feature Prompts',
      outputKey: 'feature_prompts',
      wave: 2,
      maxTokens: 3000,
      lightModel: { provider: 'groq', model: 'llama-3.1-8b-instant' },
      systemPrompt: `You are a senior developer writing AI coding prompts. Each prompt must be detailed enough for an AI coding agent to implement the feature without additional context. Output ONLY valid JSON.`,
      userPrompt: `${sharedContext}

Generate build prompts for every feature in the confirmed list above.

{
  "featurePrompts": {
    "Exact Feature Name": {
      "title": "Build: Feature Name",
      "buildPrompt": "Complete prompt for an AI coding agent. Include: what to build, technical approach using ${ctx.selectedStack.frontend} and ${ctx.selectedStack.backend}, key files to create, edge cases, expected output. Reference specific stack choices, not generic terms. 100-150 words minimum.",
      "type": "frontend|backend|database|testing|architecture",
      "contextFilesNeeded": ["reminisce/context/architecture.md", "reminisce/context/tech-stack.md"],
      "expectedOutput": "What exists when this feature is complete — files, endpoints, UI components, tests.",
      "checklist": ["Item 1", "Item 2", "Item 3"],
      "modelSuggested": "llama-3.1-8b-instant|llama-3.3-70b-versatile|codestral-latest"
    }
  }
}

RULES:
- Every feature from CONFIRMED FEATURES must have an entry — use exact name as key
- contextFilesNeeded: use paths starting with reminisce/context/
- modelSuggested: codestral-latest for code-heavy, llama-3.3-70b-versatile for architecture/backend, llama-3.1-8b-instant for simple UI/testing
- Output ONLY the JSON object`,
    },

    // ── STEP 3 — Phase Prompts (Wave 2, parallel with Step 2) ────────────
    {
      step: 3,
      label: 'Phase Prompts',
      outputKey: 'phase_prompts',
      wave: 2,
      maxTokens: 2000,
      lightModel: { provider: 'groq', model: 'llama-3.1-8b-instant' },
      systemPrompt: `You are a technical lead writing phase kickoff prompts. Output ONLY valid JSON.`,
      userPrompt: `${sharedContext}

Generate phase overview prompts for each phase implied by the features list.

{
  "phasePrompts": {
    "Exact Phase Name": {
      "title": "Phase Overview: Phase Name",
      "overviewPrompt": "What a developer reads at phase start: objective, what was built before, what this phase delivers, technical approach with ${ctx.selectedStack.frontend}/${ctx.selectedStack.backend}, key files to create. 150 words minimum.",
      "completionChecklist": [
        "Observable fact 1 — testable",
        "Observable fact 2",
        "Observable fact 3",
        "Observable fact 4",
        "Observable fact 5"
      ],
      "estimatedWeeks": 2
    }
  }
}

RULES:
- Minimum 5 checklist items per phase, written as observable facts not tasks
- overviewPrompt must name specific stack technologies, not generic terms
- Output ONLY the JSON object`,
    },

    // ── STEP 4 — Master Prompt + Editor Files (Wave 3) ───────────────────
    // Generates: master-prompt.md + the editor integration file
    // (.cursorrules / CLAUDE.md / .github/copilot-instructions.md / .windsurfrules)
    // Token budget: 2000 — master prompt should be concise and injection-ready
    {
      step: 4,
      label: 'Master Prompt',
      outputKey: 'master_prompt',
      wave: 3,
      maxTokens: 2000,
      lightModel: { provider: 'groq', model: 'llama-3.1-8b-instant' },
      systemPrompt: `You are a technical architect creating context injection files for an AI-assisted development workflow. Output ONLY valid JSON.`,
      userPrompt: `${sharedContext}

Generate the master context prompt and editor integration file.

{
  "masterPrompt": "The single document an AI coding agent reads to understand this project. Cover: project purpose, tech stack with specific versions and rationale, architecture overview, folder structure, naming conventions, coding patterns to follow, how to approach tasks, which context files to reference for which questions, error handling approach. 300-400 words. Written as instructions to an AI agent, second person.",
  "masterPromptTitle": "Master Context: ${ctx.projectName}",
  "editorFile": {
    "path": "${editorSpec.path}",
    "content": "${editorSpec.instructionLine}\\n\\n[GENERATED BLOCK — managed by Reminisce, do not edit manually]\\n\\n## Project: ${ctx.projectName}\\n[2-sentence project summary]\\n\\n## Stack\\n[3-4 bullet points: framework, backend, database, hosting]\\n\\n## Architecture\\n[2-3 sentence overview from the architecture you just described]\\n\\n## Current Focus\\n[Phase 1 name and its objective]\\n\\n## Rules\\n[5-7 short coding rules from the guidelines — bullet points]\\n\\n## Context Files\\n- reminisce/context/architecture.md — system design and components\\n- reminisce/context/tech-stack.md — stack details and versions\\n- reminisce/context/coding-guidelines.md — conventions and patterns\\n- reminisce/context/product-scope.md — v1 scope boundaries\\n- reminisce/prompts/master-prompt.md — full project context\\n\\n[END GENERATED BLOCK]\\n\\n[MANUAL ADDITIONS — safe to edit, not overwritten by Reminisce]"
  },
  "contextFilesIndex": {
    "reminisce/context/architecture.md": "System architecture and component overview",
    "reminisce/context/tech-stack.md": "Stack details, versions, and setup",
    "reminisce/context/coding-guidelines.md": "Code style and conventions",
    "reminisce/context/product-scope.md": "Product scope and success metrics",
    "reminisce/workflow/phases.md": "Current phase status and timeline",
    "reminisce/workflow/features.md": "Feature list with statuses and assignments",
    "reminisce/prompts/master-prompt.md": "Full master context for AI sessions"
  }
}

RULES:
- masterPrompt must be written as direct instructions to an AI coding agent, not a description
- editorFile.content: fill in [bracketed placeholders] with real project content — do not leave them as placeholders
- editorFile.path must be exactly: ${editorSpec.path}
- Keep editorFile.content under 400 words — it is injected into every editor session automatically
- Output ONLY the JSON object`,
    },
  ]
}

// ─────────────────────────────────────────────────────────────────────────────
//  Editor integration file spec
//  Returns the file path and format instruction for the chosen editor.
//  Called by buildGenerationPrompts Step 4.
// ─────────────────────────────────────────────────────────────────────────────

function buildEditorSpec(
  editorPreference: string,
  projectName: string,
): { path: string; instructionLine: string } {
  switch (editorPreference) {
    case 'cursor':
      return {
        path: 'reminisce/editor/.cursorrules',
        instructionLine: `# Cursor Rules — ${projectName}`,
      }
    case 'claude-code':
      return {
        path: 'reminisce/editor/CLAUDE.md',
        instructionLine: `# CLAUDE.md — ${projectName}`,
      }
    case 'copilot':
      return {
        path: 'reminisce/editor/.github/copilot-instructions.md',
        instructionLine: `# GitHub Copilot Instructions — ${projectName}`,
      }
    case 'windsurf':
      return {
        path: 'reminisce/editor/.windsurfrules',
        instructionLine: `# Windsurf Rules — ${projectName}`,
      }
    default:
      return {
        path: 'reminisce/editor/reminisce-context.md',
        instructionLine: `# Reminisce Project Context — ${projectName}`,
      }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Error classification
// ─────────────────────────────────────────────────────────────────────────────

export type WizardErrorType =
  | 'rate_limit'
  | 'timeout'
  | 'no_key'
  | 'invalid_key'
  | 'model_not_found'
  | 'stream_died'
  | 'parse_failed'
  | 'generation_partial'
  | 'unknown'

export interface WizardError {
  type: WizardErrorType
  message: string
  actionLabel: string
  action: 'change_model' | 'retry' | 'retry_step' | 'contact_support'
  retryAfterSeconds?: number
}

export function classifyError(err: unknown): WizardError {
  const msg = err instanceof Error ? err.message : String(err)
  const lower = msg.toLowerCase()

  if (lower.includes('daily_limit_exceeded')) {
    return { type: 'rate_limit', message: 'Daily limit reached for this model. Try a different model or come back tomorrow.', actionLabel: 'Change Model', action: 'change_model' }
  }
  if (lower.includes('429') || lower.includes('rate limit') || lower.includes('too many requests')) {
    const retryMatch = msg.match(/retry-after:(\d+)/)
    const retrySeconds = retryMatch ? parseInt(retryMatch[1], 10) : 60
    return { type: 'rate_limit', message: `Rate limited. ${retrySeconds <= 60 ? `Retry in ${retrySeconds}s.` : 'Try again shortly.'}`, actionLabel: 'Change Model', action: 'change_model', retryAfterSeconds: retrySeconds }
  }
  if (lower.includes('timeout') || lower.includes('timed out') || lower.includes('aborted')) {
    return { type: 'timeout', message: 'The model took too long to respond.', actionLabel: 'Try Faster Model', action: 'change_model' }
  }
  if (lower.includes('no api key') || lower.includes('no key configured')) {
    return { type: 'no_key', message: 'No API key configured for this provider.', actionLabel: 'Change Model', action: 'change_model' }
  }
  if (lower.includes('401') || lower.includes('invalid api key') || lower.includes('unauthorized')) {
    return { type: 'invalid_key', message: 'The API key for this model is invalid.', actionLabel: 'Change Model', action: 'change_model' }
  }
  if (lower.includes('404') || lower.includes('not found') || (lower.includes('model') && lower.includes('deprecated'))) {
    return { type: 'model_not_found', message: 'This model is no longer available.', actionLabel: 'Change Model', action: 'change_model' }
  }
  if (lower.includes('stream') || lower.includes('incomplete')) {
    return { type: 'stream_died', message: 'The response was cut off mid-stream.', actionLabel: 'Resend', action: 'retry' }
  }
  if (lower.includes('json') || lower.includes('parse') || lower.includes('invalid blueprint')) {
    return { type: 'parse_failed', message: 'The AI returned an unreadable response. Try a more capable model.', actionLabel: 'Change Model', action: 'change_model' }
  }
  if (lower.includes('partial') || lower.includes('step')) {
    return { type: 'generation_partial', message: 'Generation partially succeeded.', actionLabel: 'Retry Remaining Steps', action: 'retry_step' }
  }
  return { type: 'unknown', message: 'Something went wrong. Try resending your message.', actionLabel: 'Resend', action: 'retry' }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Fallback stacks — used if generation fails to produce stack options
// ─────────────────────────────────────────────────────────────────────────────

export function getFallbackStackOptions(): TechStackOption[] {
  return [
    {
      id: 'A',
      label: 'Next.js + Supabase',
      tag: 'Popular · Simple',
      complexity: 'simple',
      frontend: 'Next.js 14 (App Router)',
      backend: 'Next.js API Routes',
      database: 'Supabase (PostgreSQL)',
      hosting: 'Vercel',
      other: 'Supabase Auth, Supabase Storage',
      pros: ['Fastest to ship', 'Minimal infra', 'Built-in auth'],
      cons: ['Vendor lock-in', 'Less control over backend'],
      bestFor: 'Solo developers and small teams moving fast',
    },
    {
      id: 'B',
      label: 'React + Node + PostgreSQL',
      tag: 'Popular · Flexible',
      complexity: 'standard',
      frontend: 'React 18 + Vite',
      backend: 'Node.js + Express',
      database: 'PostgreSQL + Prisma',
      hosting: 'Railway or Render',
      other: 'Redis for caching, JWT auth',
      pros: ['Full control', 'Widely understood', 'Easy to hire for'],
      cons: ['More setup', 'Manual auth implementation'],
      bestFor: 'Teams wanting flexibility without complexity',
    },
    {
      id: 'C',
      label: 'Microservices + K8s',
      tag: 'Complex · Scalable',
      complexity: 'scalable',
      frontend: 'Next.js + CDN',
      backend: 'Multiple services (Node.js / Python)',
      database: 'PostgreSQL + MongoDB + Redis',
      hosting: 'AWS / GCP with Kubernetes',
      other: 'Message queue, API gateway, CI/CD pipeline',
      pros: ['Handles massive scale', 'Independent deployments', 'Technology flexibility'],
      cons: ['Complex to operate', 'Requires DevOps expertise', 'Slow to start'],
      bestFor: 'Products expecting rapid scale or large engineering teams',
    },
  ]
}

// ─────────────────────────────────────────────────────────────────────────────
//  Provider display names
// ─────────────────────────────────────────────────────────────────────────────

export const PROVIDER_DISPLAY: Record<string, string> = {
  groq:       'Groq',
  cerebras:   'Cerebras',
  sambanova:  'SambaNova',
  gemini:     'Gemini',
  mistral:    'Mistral',
  anthropic:  'Anthropic',
  openai:     'OpenAI',
  kimi:       'Kimi',
  minimax:    'MiniMax',
  openrouter: 'OpenRouter',
}

export const WIZARD_FREE_MODELS = [
  { provider: 'groq'      as AIProvider, model: 'llama-3.1-8b-instant',                      label: 'Llama 3.1 8B',             badge: 'FAST'   },
  { provider: 'groq'      as AIProvider, model: 'meta-llama/llama-4-scout-17b-16e-instruct', label: 'Llama 4 Scout',            badge: 'NEW'    },
  { provider: 'groq'      as AIProvider, model: 'llama-3.3-70b-versatile',                   label: 'Llama 3.3 70B',            badge: ''       },
  { provider: 'groq'      as AIProvider, model: 'moonshotai/kimi-k2-instruct-0905',          label: 'Kimi K2',                  badge: ''       },
  { provider: 'groq'      as AIProvider, model: 'qwen/qwen3-32b',                            label: 'Qwen3 32B',                badge: ''       },
  { provider: 'cerebras'  as AIProvider, model: 'llama3.1-8b',                               label: 'Llama 3.1 8B (Cerebras)',  badge: 'FAST'   },
  { provider: 'cerebras'  as AIProvider, model: 'llama-3.3-70b',                             label: 'Llama 3.3 70B (Cerebras)', badge: 'FAST'   },
  { provider: 'sambanova' as AIProvider, model: 'Meta-Llama-3.3-70B-Instruct',               label: 'Llama 3.3 70B (SN)',       badge: ''       },
  { provider: 'sambanova' as AIProvider, model: 'Meta-Llama-3.1-405B-Instruct',              label: 'Llama 405B',               badge: '405B'   },
  { provider: 'gemini'    as AIProvider, model: 'gemini-2.5-flash-lite',                     label: 'Gemini Flash-Lite',        badge: '1M CTX' },
  { provider: 'gemini'    as AIProvider, model: 'gemini-2.5-flash',                          label: 'Gemini Flash 2.5',         badge: '1M CTX' },
  { provider: 'mistral'   as AIProvider, model: 'mistral-small-latest',                      label: 'Mistral Small',            badge: ''       },
  { provider: 'mistral'   as AIProvider, model: 'codestral-latest',                          label: 'Codestral',                badge: 'CODE'   },
  { provider: 'kimi'      as AIProvider, model: 'kimi-k2.5',                                 label: 'Kimi K2.5',                badge: '256K'   },
] as const

export const WIZARD_PRO_MODELS = [
  { provider: 'anthropic' as AIProvider, model: 'claude-haiku-4-5',           label: 'Claude Haiku 4.5',  badge: ''     },
  { provider: 'anthropic' as AIProvider, model: 'claude-sonnet-4-6-20250514', label: 'Claude Sonnet 4.6', badge: 'BEST' },
  { provider: 'openai'    as AIProvider, model: 'gpt-4o-mini',                label: 'GPT-4o Mini',       badge: ''     },
  { provider: 'openai'    as AIProvider, model: 'gpt-4o',                     label: 'GPT-4o',            badge: ''     },
  { provider: 'gemini'    as AIProvider, model: 'gemini-2.5-pro',             label: 'Gemini 2.5 Pro',    badge: '1M'   },
  { provider: 'mistral'   as AIProvider, model: 'mistral-large-latest',       label: 'Mistral Large',     badge: ''     },
] as const

export type WizardModel =
  | (typeof WIZARD_FREE_MODELS)[number]
  | (typeof WIZARD_PRO_MODELS)[number]

export const ALL_WIZARD_MODELS = [
  ...WIZARD_FREE_MODELS,
  ...WIZARD_PRO_MODELS,
] as const
