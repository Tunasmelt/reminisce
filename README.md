# Reminisce v2

**AI context orchestration for developers.** Define your project once.
Every AI call, every editor session, every teammate — working from the same live context.

[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org)
[![Supabase](https://img.shields.io/badge/Supabase-Database%20%2B%20Auth-3ECF8E?logo=supabase)](https://supabase.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://typescriptlang.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## What it does

| Feature | Description |
|---|---|
| **Project Wizard** | 4-stage AI conversation → parallel blueprint generation (phases, features, context files, editor files) |
| **PAM** | Project Action Manager — AI chat with full project context, scope alerts, action confirmation, reminders |
| **Graph** | Visual swimlane map of phases and features, drag-to-reparent, annotations (notes, bugs, TODOs) |
| **Board** | Kanban with drag-and-drop, swimlane grouping, priority badges, mobile move menu |
| **Context Engine** | Versioned markdown store, diff viewer, push/pull to local folder, git state reading |
| **AI Agent** | Streaming agent runs against feature prompts with full project context injection |
| **Prompt Library** | Blueprint + custom prompts, run_count tracking, changelog |
| **API Lab** | Built-in HTTP client with SSRF protection and AI suggest |
| **Templates** | Reusable prompt templates across projects |
| **Economy** | Dual-currency (coins/gems), daily reset, BYOK bypass for all 10 providers |
| **Admin Panel** | User management, model management, audit log, wallet grants, ban system |
| **Subscription** | Stripe Pro subscriptions, gem packs, self-service cancellation |

---

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 14 (App Router), TypeScript |
| Styling | Tailwind CSS, inline CSS-in-JS |
| Database | Supabase (PostgreSQL + RLS) |
| Auth | Supabase Auth (email/password) |
| AI Providers | Groq, Cerebras, SambaNova, Gemini, Mistral, Anthropic, OpenAI, Kimi, MiniMax, OpenRouter |
| Payments | Stripe (subscriptions + one-time gem packs) |
| Local FS | File System Access API + IndexedDB |
| Graph | Custom canvas (pan/zoom/touch), swimlane layout |
| Visualisation | React Three Fiber (landing), ReactFlow types (graph types) |

---

## Quick start

### 1. Clone and install
```bash
git clone https://github.com/your-username/reminisce-v2.git
cd reminisce-v2
npm install
```

### 2. Configure environment
```bash
cp .env.example .env.local
```

Fill in `.env.local` — minimum for local dev:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
ENCRYPTION_SECRET=your-32-char-secret-here
GROQ_API_KEY=your-groq-key
```

### 3. Run database migrations
In Supabase Dashboard → SQL Editor, run each migration file in order:
```
supabase/migrations/00000000000000_core_schema.sql
supabase/migrations/00000000000001_economy_and_wallet.sql
supabase/migrations/00000000000002_graph_and_board.sql
supabase/migrations/00000000000005_pam_threads.sql
supabase/migrations/00000000000006_pam_phase2_and_prompts.sql
supabase/migrations/00000000000007_project_reminders.sql
supabase/migrations/00000000000008_context_sync_and_git.sql
supabase/migrations/00000000000009_admin_and_models.sql
supabase/migrations/00000000000010_missing_columns_and_templates.sql
supabase/migrations/00000000000011_admin_logs_columns.sql
```

Skip `00000000000004` (placeholder file).

### 4. Start dev server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment variables

### Required
| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only, never expose) |
| `NEXT_PUBLIC_APP_URL` | Your deployment URL (no trailing slash) |
| `ENCRYPTION_SECRET` | 32-character secret for BYOK key encryption |
| `GROQ_API_KEY` | Free tier AI provider (get at console.groq.com) |

### AI providers (add as needed)
| Variable | Tier | Notes |
|---|---|---|
| `CEREBRAS_API_KEY` | Free | Ultra-fast inference |
| `SAMBANOVA_API_KEY` | Free | Large model quality |
| `GEMINI_API_KEY` | Free + Pro | Gemini 2.0 Flash (free), 2.5 Pro (Pro tier) |
| `MISTRAL_API_KEY` | Free + Pro | Mistral Small (free), Large/Codestral (Pro) |
| `KIMI_API_KEY` | Free | Long-context Kimi K2.5 |
| `ANTHROPIC_API_KEY` | Pro | Claude Sonnet/Haiku (gems) |
| `OPENAI_API_KEY` | Pro | GPT-4o (gems) |
| `OPENROUTER_API_KEY` | Free + Pro | Fallback multi-provider |

### Stripe (required for payments)
| Variable | Description |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_live_...` (or `sk_test_...` for staging) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` from Stripe webhook dashboard |
| `STRIPE_PRO_PRICE_ID` | `price_...` for your Pro monthly product |

---

## Architecture

```
app/
├── api/                        # 36 API routes, all force-dynamic
│   ├── admin/                  # Admin panel (verifyAdmin gated)
│   ├── agent/                  # AI agent runs (streaming SSE)
│   ├── context/                # Context versioning + history
│   ├── keys/                   # BYOK key management (AES-256 encrypted)
│   ├── pam/                    # PAM threads, messages, reminders
│   ├── projects/               # Project CRUD
│   ├── prompts/                # Prompt library
│   ├── proxy/                  # SSRF-protected HTTP proxy (API Lab)
│   ├── rewards/                # Daily login coin grants
│   ├── stripe/                 # Checkout, webhook, cancellation
│   ├── templates/              # Prompt templates
│   └── wizard/                 # Chat, generate, session
├── admin/                      # Admin console (middleware gated)
├── dashboard/
│   ├── page.tsx                # Projects list
│   └── projects/[id]/
│       ├── page.tsx            # Project overview
│       ├── wizard/             # Blueprint generation
│       ├── agent/              # PAM chat
│       ├── graph/              # Visual graph + board shared data
│       ├── board/              # Kanban board
│       ├── context/            # Context file editor
│       ├── prompts/            # Prompt library
│       ├── api-lab/            # HTTP client
│       └── settings/           # Project settings + BYOK + subscription
lib/
├── ai-client.ts                # Unified AI provider client (10 providers)
├── wallet.ts                   # Economy: MODEL_COSTS, deduct, refund, award
├── wizard-stages.ts            # Wizard stage config + generation prompts
├── fsapi.ts                    # File System Access API + git state
├── admin-auth.ts               # verifyAdmin() helper
├── encryption.ts               # AES-GCM BYOK key encryption
└── supabase.ts                 # Client, service role, verifyProjectAccess, isUserBanned
```

---

## Economy system

| Currency | Free plan | Pro plan | Used for |
|---|---|---|---|
| **Coins** 🪙 | 50/day | 200/day | Free-tier models (Groq, Cerebras, etc.) |
| **Gems** 💎 | 0 | 100/month + purchasable | Pro models (Claude, GPT-4o, Gemini Pro) |

BYOK (Bring Your Own Key) bypasses the economy entirely.

---

## Security

- All API routes gated by JWT auth (`getUser` or `getSession`)
- Project data protected by `verifyProjectAccess` (workspace ownership join)
- PAM threads protected by `verifyThreadOwnership`
- Banned user checks on AI-consuming routes
- BYOK keys encrypted with AES-256-GCM using `ENCRYPTION_SECRET`
- Admin routes double-gated (middleware cookie check + DB `is_admin` flag)
- Stripe webhook validated with `constructEvent` signature check
- SSRF protection in API Lab proxy (blocks private IP ranges + metadata endpoints)
- Row Level Security enabled on all 26 tables

---

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for complete Vercel deployment instructions.

---

## License

MIT — see [LICENSE](LICENSE).
