import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Browser client using anon key
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Server client using service role key (for API routes only)
export const getServiceSupabase = () => {
  return createClient(supabaseUrl, supabaseServiceRoleKey)
}
