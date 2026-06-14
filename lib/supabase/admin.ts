import 'server-only'
import { createClient } from '@supabase/supabase-js'

/**
 * Service-role Supabase client for privileged admin operations (creating auth
 * users, etc.). Bypasses RLS — NEVER import this from a client component.
 * Returns null when SUPABASE_SERVICE_ROLE_KEY isn't configured so callers can
 * surface a clear setup error instead of crashing.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
