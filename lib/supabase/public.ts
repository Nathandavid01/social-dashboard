import 'server-only'
import { createClient } from '@supabase/supabase-js'

/**
 * Anon Supabase client with NO user session — for the public review link path
 * (`/review/<token>`), which is unauthenticated. It reaches data only through
 * the SECURITY DEFINER RPCs of migration 0042 (granted to `anon`), which enforce
 * token scoping + expiry in-DB. The service-role key intentionally stays OUT of
 * this path. Returns null if env isn't configured so callers can 404 cleanly.
 */
export function createPublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return null
  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
