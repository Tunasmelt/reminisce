import { getServiceSupabase } from '@/lib/supabase'

// ─── MODEL COSTS ──────────────────────────────
// coin  = free tier (any user)
// gem   = premium tier (pro users only)

export const MODEL_COSTS: Record<string, {
  currency: 'coins' | 'gems'
  amount: number
  tier: 'free' | 'pro'
}> = {
  // Free tier — OpenRouter free models (coins)
  'meta-llama/llama-3.3-70b-instruct:free':
    { currency: 'coins', amount: 1, tier: 'free' },
  'google/gemini-2.0-flash-exp:free':
    { currency: 'coins', amount: 1, tier: 'free' },
  'mistralai/mistral-7b-instruct:free':
    { currency: 'coins', amount: 1, tier: 'free' },
  'mistralai/mistral-small-3.1-24b-instruct:free':
    { currency: 'coins', amount: 1, tier: 'free' },
  'nvidia/llama-3.1-nemotron-super-49b-v1:free':
    { currency: 'coins', amount: 1, tier: 'free' },
  'nvidia/llama-nemotron-nano-8b-instruct:free':
    { currency: 'coins', amount: 1, tier: 'free' },
  // Pro tier — direct API models (gems)
  'mistral-small-latest':
    { currency: 'gems', amount: 1, tier: 'pro' },
  'mistral-large-latest':
    { currency: 'gems', amount: 2, tier: 'pro' },
  'gemini-2.0-flash':
    { currency: 'gems', amount: 1, tier: 'pro' },
  'claude-sonnet-4-20250514':
    { currency: 'gems', amount: 3, tier: 'pro' },
  'gpt-4o':
    { currency: 'gems', amount: 3, tier: 'pro' },
}

// ─── PLAN HELPERS ─────────────────────────────

export type UserPlan = {
  plan: 'free' | 'pro'
  status: string
  projects_limit: number
}

export async function getUserPlan(
  userId: string
): Promise<UserPlan> {
  const supabase = getServiceSupabase()
  const { data } = await supabase
    .from('user_plans')
    .select('plan, status, projects_limit')
    .eq('user_id', userId)
    .single()
  return data || { 
    plan: 'free', 
    status: 'active', 
    projects_limit: 2 
  }
}

export async function canCreateProject(
  userId: string
): Promise<{ 
  allowed: boolean
  reason?: string
  current: number
  limit: number
}> {
  const supabase = getServiceSupabase()
  
  // Count projects where the user is the owner of the workspace
  const { count: projCount } = await supabase
    .from('projects')
    .select(`
      id,
      workspaces!inner(owner_id)
    `, { count: 'exact', head: true })
    .eq('workspaces.owner_id', userId)

  const plan = await getUserPlan(userId)
  const current = projCount || 0
  const limit = plan.projects_limit

  if (current >= limit) {
    return {
      allowed: false,
      reason: plan.plan === 'free'
        ? `Free tier allows ${limit} projects. Upgrade to Pro for unlimited projects.`
        : `You've reached your project limit of ${limit}.`,
      current,
      limit,
    }
  }
  return { allowed: true, current, limit }
}

// ─── WALLET HELPERS ───────────────────────────

export type Wallet = {
  gems: number
  coins: number
  coins_last_reset: string | null
  daily_coins_limit: number
  max_coins_banked: number
}

export async function getWallet(
  userId: string
): Promise<Wallet> {
  const supabase = getServiceSupabase()
  const { data } = await supabase
    .from('user_wallets')
    .select('gems, coins, coins_last_reset, daily_coins_limit, max_coins_banked')
    .eq('user_id', userId)
    .single()
  return data || { 
    gems: 0, 
    coins: 50, 
    coins_last_reset: null,
    daily_coins_limit: 50,
    max_coins_banked: 200,
  }
}

export async function ensureWallet(
  userId: string,
  plan: 'free' | 'pro' = 'free'
): Promise<void> {
  const supabase = getServiceSupabase()
  const isProPlan = plan === 'pro'
  await supabase
    .from('user_wallets')
    .upsert({
      user_id: userId,
      gems: 0,
      coins: isProPlan ? 200 : 50,
      daily_coins_limit: isProPlan ? 200 : 50,
      max_coins_banked: isProPlan ? 500 : 200,
      gems_monthly_grant: isProPlan ? 100 : 0,
    }, { 
      onConflict: 'user_id',
      ignoreDuplicates: true 
    })
}

// Check and apply daily reset if needed
export async function applyDailyReset(
  userId: string
): Promise<void> {
  const supabase = getServiceSupabase()
  const wallet = await getWallet(userId)
  
  const lastReset = wallet.coins_last_reset
    ? new Date(wallet.coins_last_reset)
    : new Date(0)
  
  const now = new Date()
  const todayUTC = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate()
    )
  )
  
  // If last reset was before today UTC, reset
  if (lastReset < todayUTC) {
    const newCoins = Math.max(
      wallet.coins,
      wallet.daily_coins_limit
    )
    const capped = Math.min(
      newCoins,
      wallet.max_coins_banked
    )
    await supabase
      .from('user_wallets')
      .update({ 
        coins: capped,
        coins_last_reset: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('user_id', userId)
    
    // Log reset transaction
    if (capped - wallet.coins > 0) {
      await supabase
        .from('wallet_transactions')
        .insert({
          user_id: userId,
          type: 'credit',
          amount: capped - wallet.coins,
          currency: 'coins',
          description: 'Daily coin reset',
          transaction_source: 'daily_reset',
        })
    }
  }
}

// ─── COST DEDUCTION ───────────────────────────

export async function deductCost(
  userId: string,
  model: string,
  runId?: string
): Promise<{
  success: boolean
  message?: string
  currency?: string
  amount?: number
}> {
  // Apply daily reset before checking balance
  await applyDailyReset(userId)
  
  const cost = MODEL_COSTS[model] 
    ?? { currency: 'coins' as const, 
         amount: 1, tier: 'free' as const }
  
  // Check if user is allowed to use gem models
  if (cost.tier === 'pro') {
    const plan = await getUserPlan(userId)
    if (plan.plan !== 'pro') {
      return {
        success: false,
        message: `${model.split('/').pop()} requires a Pro subscription. Upgrade to use premium models.`,
      }
    }
  }
  
  const supabase = getServiceSupabase()
  const wallet = await getWallet(userId)
  
  const balance = cost.currency === 'gems'
    ? wallet.gems
    : wallet.coins
    
  if (balance < cost.amount) {
    const msg = cost.currency === 'gems'
      ? `Not enough gems. You have ${wallet.gems} gems. Pro subscribers receive 100 gems/month.`
      : `Not enough coins. You have ${wallet.coins} coins. Your daily allowance resets at midnight UTC.`
    return { success: false, message: msg }
  }
  
  const updateField = cost.currency === 'gems'
    ? { gems: wallet.gems - cost.amount,
        updated_at: new Date().toISOString() }
    : { coins: wallet.coins - cost.amount,
        updated_at: new Date().toISOString() }
    
  await supabase
    .from('user_wallets')
    .update(updateField)
    .eq('user_id', userId)
  
  await supabase
    .from('wallet_transactions')
    .insert({
      user_id: userId,
      type: 'debit',
      amount: -cost.amount,
      currency: cost.currency,
      model_used: model,
      run_id: runId || null,
      description: `Agent run: ${model}`,
      transaction_source: 'run',
    })
  
  return { 
    success: true, 
    currency: cost.currency,
    amount: cost.amount 
  }
}

// ─── REFUND ───────────────────────────────────

export async function refundCost(
  userId: string,
  model: string,
  runId?: string
): Promise<void> {
  try {
    const cost = MODEL_COSTS[model]
    if (!cost) return
    const supabase = getServiceSupabase()
    const wallet = await getWallet(userId)
    
    const updateField = cost.currency === 'gems'
      ? { gems: wallet.gems + cost.amount,
          updated_at: new Date().toISOString() }
      : { coins: Math.min(
            wallet.coins + cost.amount,
            wallet.max_coins_banked
          ),
          updated_at: new Date().toISOString() }
    
    await supabase
      .from('user_wallets')
      .update(updateField)
      .eq('user_id', userId)
    
    await supabase
      .from('wallet_transactions')
      .insert({
        user_id: userId,
        type: 'refund',
        amount: cost.amount,
        currency: cost.currency,
        model_used: model,
        run_id: runId || null,
        description: 'Refund: run failed',
        transaction_source: 'refund',
      })
  } catch (err) {
    console.warn('Refund non-fatal:', err)
  }
}

// ─── COIN REWARDS ─────────────────────────────

export type RewardEvent = 
  | 'wizard_complete'  // +25 coins, once per project
  | 'first_agent_run'  // +15 coins, once per project
  | 'daily_login'      // +10 coins, once per day
  | 'save_context'     // +5 coins, once per day

export async function awardCoins(
  userId: string,
  event: RewardEvent,
  referenceId?: string // projectId for per-project events
): Promise<{ awarded: boolean; amount: number }> {
  try {
    const supabase = getServiceSupabase()
    
    const REWARDS: Record<RewardEvent, number> = {
      wizard_complete: 25,
      first_agent_run: 15,
      daily_login: 10,
      save_context: 5,
    }
    
    const amount = REWARDS[event]
    
    // Check if this reward was already given
    const query = supabase
      .from('wallet_transactions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('transaction_source', event)

    if (referenceId) {
      query.eq('metadata->>referenceId', referenceId)
    }

    if (event === 'daily_login' || event === 'save_context') {
      const today = new Date(Date.UTC(
          new Date().getUTCFullYear(),
          new Date().getUTCMonth(),
          new Date().getUTCDate()
      )).toISOString()
      query.gte('created_at', today)
    }
    
    const { count } = await query
    
    if ((count || 0) > 0) {
      return { awarded: false, amount: 0 }
    }
    
    const wallet = await getWallet(userId)
    const newCoins = Math.min(
      wallet.coins + amount,
      wallet.max_coins_banked
    )
    
    await supabase
      .from('user_wallets')
      .update({ 
        coins: newCoins,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
    
    await supabase
      .from('wallet_transactions')
      .insert({
        user_id: userId,
        type: 'credit',
        amount,
        currency: 'coins',
        description: `Reward: ${event.replace('_', ' ')}`,
        transaction_source: event,
        metadata: { referenceId: referenceId || '' },
      })
    
    return { awarded: true, amount }
  } catch (err) {
    console.warn('Award coins failed:', err)
    return { awarded: false, amount: 0 }
  }
}
