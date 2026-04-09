# Deploying Reminisce v2 to Vercel

## Prerequisites

- GitHub account with the repository pushed
- [Vercel](https://vercel.com) account
- [Supabase](https://supabase.com) project (already set up)
- [Stripe](https://stripe.com) account with a Pro product created

---

## Step 1 — Prepare the database

Run all migrations in your Supabase SQL Editor **in this exact order**:

1. `00000000000000_core_schema.sql`
2. `00000000000001_economy_and_wallet.sql`
3. `00000000000002_graph_and_board.sql`
4. *(skip 00000000000004 — placeholder)*
5. `00000000000005_pam_threads.sql`
6. `00000000000006_pam_phase2_and_prompts.sql`
7. `00000000000007_project_reminders.sql`
8. `00000000000008_context_sync_and_git.sql`
9. `00000000000009_admin_and_models.sql`
10. `00000000000010_missing_columns_and_templates.sql`
11. `00000000000011_admin_logs_columns.sql`

After running, verify:
```sql
SELECT COUNT(*) FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'user_wallets'    AND column_name = 'gems_last_granted')  OR
    (table_name = 'user_plans'      AND column_name IN ('is_admin','banned_at')) OR
    (table_name = 'provider_models' AND column_name IN ('enabled','tier_required')) OR
    (table_name = 'contexts'        AND column_name IN ('file_hash','owned_by')) OR
    (table_name = 'agent_runs'      AND column_name = 'model_used') OR
    (table_name = 'admin_logs'      AND column_name IN ('target_id','target_type'))
  );
-- Expected: 10 rows
```

Set your admin account:
```sql
UPDATE public.user_plans
  SET is_admin = true
  WHERE user_id = 'YOUR-SUPABASE-USER-UUID-HERE';
```

---

## Step 2 — Configure Supabase Auth

In Supabase Dashboard → Authentication → URL Configuration:

| Setting | Value |
|---|---|
| Site URL | `https://your-app.vercel.app` |
| Redirect URLs | `https://your-app.vercel.app/**` |

> ⚠️ Without this, login redirects fail in production.

---

## Step 3 — Create Stripe products

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/products)
2. Create a product: **Reminisce Pro** — $X/month recurring
3. Note the **Price ID** (starts with `price_`)
4. For gem packs, prices are created dynamically via `price_data` in the checkout route — no manual creation needed

---

## Step 4 — Deploy to Vercel

### 4a — Push to GitHub
```bash
git add -A
git commit -m "chore: prepare for production deploy"
git push origin main
```

### 4b — Import in Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click **Import Git Repository** → select your repo
3. Framework preset: **Next.js** (auto-detected)
4. Build command: `npm run build` (auto-detected)
5. Output directory: `.next` (auto-detected)

### 4c — Set environment variables

In Vercel → Project → Settings → Environment Variables, add **all** of these:

**Required (deploy fails without these):**
NEXT_PUBLIC_SUPABASE_URL        = https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY   = eyJ...
SUPABASE_SERVICE_ROLE_KEY       = eyJ...
NEXT_PUBLIC_APP_URL             = https://your-app.vercel.app
ENCRYPTION_SECRET               = (32 random chars — generate below)
GROQ_API_KEY                    = gsk_...

Generate ENCRYPTION_SECRET:
```bash
openssl rand -base64 24
# or: node -e "console.log(require('crypto').randomBytes(24).toString('base64'))"
```

**AI providers (add all you have keys for):**
CEREBRAS_API_KEY    =
SAMBANOVA_API_KEY   =
GEMINI_API_KEY      =
MISTRAL_API_KEY     =
KIMI_API_KEY        =
ANTHROPIC_API_KEY   =
OPENAI_API_KEY      =
OPENROUTER_API_KEY  =

**Stripe (add even if sk_test_ for now):**
STRIPE_SECRET_KEY     = sk_live_... (or sk_test_...)
STRIPE_WEBHOOK_SECRET = whsec_...  (get this in Step 5)
STRIPE_PRO_PRICE_ID   = price_...

> Set Environment to **Production**, **Preview**, and **Development** for all vars.

### 4d — Deploy

Click **Deploy**. First deploy takes 2-4 minutes.

Once deployed, note your URL: `https://your-app-name.vercel.app`

---

## Step 5 — Configure Stripe webhook

> Do this **after** first deploy so your URL is known.

1. Go to [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks)
2. Click **Add endpoint**
3. Endpoint URL: `https://your-app.vercel.app/api/stripe/webhook`
4. Select events:
   - `checkout.session.completed`
   - `customer.subscription.deleted`
   - `invoice.paid`
5. Click **Add endpoint**
6. Click **Reveal** on the Signing secret (`whsec_...`)
7. Copy it → go to Vercel → Environment Variables → add `STRIPE_WEBHOOK_SECRET`
8. **Redeploy** (Vercel → Deployments → Redeploy latest)

---

## Step 6 — Update Supabase Auth URL

Now that you have your final Vercel URL:

1. Supabase Dashboard → Authentication → URL Configuration
2. Update Site URL and Redirect URLs to your actual Vercel domain
3. If domain was already set correctly in Step 2, no action needed

---

## Step 7 — Smoke test production

Work through this checklist on the live URL:

**Auth**
- [ ] Sign up with a new email → receives confirmation email
- [ ] Sign in → lands on dashboard
- [ ] Wallet shows 50 coins

**Core flow**
- [ ] Create project → open wizard → generate blueprint (uses Groq)
- [ ] PAM opens → send a message → streams response
- [ ] Graph opens → phases and features render
- [ ] Board opens → drag a card between columns

**Payments** (use Stripe test card `4242 4242 4242 4242`)
- [ ] Click Upgrade → Stripe checkout page loads
- [ ] Complete test payment → redirected back to dashboard with Pro badge
- [ ] Settings → Subscription tab shows Pro status
- [ ] Click Cancel → confirmation → status shows cancelled

**Admin** (as your admin account)
- [ ] Navigate to `/admin` → Overview stats load
- [ ] Users tab → your email appears
- [ ] Click 🪙 on a user → add 50 coins → verify updated

---

## Maintenance

### Adding AI models
1. `/admin` → AI Models tab → Add Model
2. Fill in provider, model_id (exact API model string), display name
3. Check "Free tier" if costs coins, uncheck for gems
4. Set sort_order (lower = appears first in dropdowns)
5. Toggle enabled on

### Granting admin access to a new admin
```sql
UPDATE public.user_plans
  SET is_admin = true
  WHERE user_id = 'USER-UUID';
```

### Monitoring
- Vercel → Logs: real-time function logs per route
- Supabase → Database → Logs: query performance
- Stripe → Developers → Events: webhook delivery status

### Updating the app
```bash
git add -A
git commit -m "feat: your change"
git push origin main
# Vercel auto-deploys on push to main
```

---

## Common issues

| Issue | Cause | Fix |
|---|---|---|
| Login redirect fails | Auth URL not updated | Set Site URL in Supabase Auth settings |
| Stripe webhook 400 | Wrong `STRIPE_WEBHOOK_SECRET` | Re-copy signing secret from Stripe |
| AI models not loading | `provider_models` table empty | Re-run migration 0 seed section |
| Admin panel 403 | `is_admin` not set | Run the UPDATE SQL in Step 1 |
| Coins not resetting | `handle_new_user` trigger not created | Re-run migration 1 |
| Build fails on Vercel | Missing env var | Check all required vars are set |
