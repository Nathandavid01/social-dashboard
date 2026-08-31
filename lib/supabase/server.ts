import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { applyCookiePersistence } from './cookie-persistence'

export async function createClient(opts?: { sessionOnly?: boolean }) {
  const cookieStore = await cookies()
  const sessionOnly = opts?.sessionOnly === true

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, applyCookiePersistence(options, sessionOnly))
            )
          } catch {
            // Server Component — cookies will be set by middleware
          }
        },
      },
    }
  )
}
