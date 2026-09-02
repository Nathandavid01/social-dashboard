import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { applyCookiePersistence } from './cookie-persistence'
import { invalidateRequestMemo, memoPerRequest } from './request-memo'

/**
 * `auth.getUser()` es una llamada de red a Supabase Auth. Una página del
 * dashboard la disparaba 8–15 veces por carga (layout + helpers de permisos +
 * cada action de lectura), todas secuenciales: ese era el grueso del TTFB.
 * Dentro de un request la sesión no cambia salvo que este mismo cliente la
 * mute. Se enumeran las LECTURAS seguras; cualquier otro método de `auth`
 * (signOut, signIn*, setSession, updateUser, lo que venga en el SDK) vacía la
 * memo al terminar. Así un método nuevo falla cerrado: invalida de más, nunca
 * sirve una sesión vieja.
 */
const AUTH_READS = new Set(['getUser', 'getSession', 'getClaims', 'getUserIdentities', 'onAuthStateChange'])

function memoizeAuth<T extends { auth: object }>(client: T): T {
  const auth = client.auth as Record<string, unknown>
  const getUser = (auth.getUser as (...args: unknown[]) => Promise<unknown>).bind(client.auth)

  const proxied = new Proxy(client.auth, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver)
      if (typeof value !== 'function' || typeof prop !== 'string') return value
      if (prop === 'getUser') {
        return (...args: unknown[]) =>
          args.length === 0 ? memoPerRequest('supabase.auth.getUser', () => getUser()) : getUser(...args)
      }
      if (AUTH_READS.has(prop)) return value.bind(target)
      return async (...args: unknown[]) => {
        const result = await value.apply(target, args)
        await invalidateRequestMemo()
        return result
      }
    },
  })
  Object.defineProperty(client, 'auth', { value: proxied, configurable: true, writable: true })
  return client
}

export async function createClient(opts?: { sessionOnly?: boolean }) {
  const cookieStore = await cookies()
  const sessionOnly = opts?.sessionOnly === true

  return memoizeAuth(
    createServerClient(
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
  )
}
