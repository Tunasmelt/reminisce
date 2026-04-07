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

/**
 * Verifies that userId owns the project (via workspace ownership).
 * Use in any API route that calls getServiceSupabase() and accepts projectId.
 * Returns true if the user owns the project, false otherwise.
 */
export async function verifyProjectAccess(
  userId: string,
  projectId: string,
): Promise<boolean> {
  const supabase = getServiceSupabase()
  const { data } = await supabase
    .from('projects')
    .select('id, workspaces!inner(owner_id)')
    .eq('id', projectId)
    .single()
  if (!data) return false
  return (data.workspaces as unknown as { owner_id: string }).owner_id === userId
}

