import { getServiceSupabase } from '@/lib/supabase'

export const MODEL_COSTS: Record<string, {
  currency: 'coins' | 'gems'
  amount: number
}> = {
  'meta-llama/llama-3.3-70b-instruct:free': 
    { currency: 'coins', amount: 1 },
  'google/gemini-2.0-flash-exp:free':       
    { currency: 'coins', amount: 1 },
  'mistralai/mistral-7b-instruct:free':     
    { currency: 'coins', amount: 1 },
  'mistral-small-latest':                   
    { currency: 'gems', amount: 1 },
  'mistral-large-latest':                   
    { currency: 'gems', amount: 2 },
  'claude-sonnet-4-20250514':               
    { currency: 'gems', amount: 3 },
  'gemini-2.0-flash':                       
    { currency: 'gems', amount: 1 },
}

export async function getWallet(userId: string) {
  const supabase = getServiceSupabase()
  const { data } = await supabase
    .from('user_wallets')
    .select('gems, coins')
    .eq('user_id', userId)
    .single()
  return data || { gems: 0, coins: 0 }
}

export async function ensureWallet(userId: string) {
  const supabase = getServiceSupabase()
  await supabase
    .from('user_wallets')
    .upsert({ user_id: userId, gems: 0, coins: 100 },
             { onConflict: 'user_id', 
               ignoreDuplicates: true })
}

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
  const cost = MODEL_COSTS[model] 
    ?? { currency: 'coins' as const, amount: 1 }
  
  const supabase = getServiceSupabase()
  const wallet = await getWallet(userId)
  
  const balance = cost.currency === 'gems'
    ? wallet.gems
    : wallet.coins
    
  if (balance < cost.amount) {
    return {
      success: false,
      message: cost.currency === 'gems'
        ? 'Not enough gems. Purchase gems to use premium models.'
        : 'Not enough coins. Free coins reset daily.',
    }
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
    })
  
  return { 
    success: true, 
    currency: cost.currency,
    amount: cost.amount 
  }
}

export async function refundCost(
  userId: string,
  model: string,
  runId?: string
) {
  try {
    const cost = MODEL_COSTS[model]
    if (!cost) return
    const supabase = getServiceSupabase()
    const wallet = await getWallet(userId)
    
    const updateField = cost.currency === 'gems'
      ? { gems: wallet.gems + cost.amount,
          updated_at: new Date().toISOString() }
      : { coins: wallet.coins + cost.amount,
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
        description: `Refund: run failed`,
      })
  } catch (err) {
    console.warn('Refund failed (non-fatal):', err)
  }
}
