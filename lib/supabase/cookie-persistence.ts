/**
 * Auth cookies always persist (email/password login has no session-only
 * opt-out). `SESSION_ONLY_COOKIE` is a leftover marker from the old
 * "Mantener sesión iniciada" checkbox. A stale marker must never make
 * middleware strip maxAge/expires on token refresh — that dropped sessions.
 *
 *  - `shouldUseSessionOnlyCookies`: always false. Middleware and the server
 *    client must call this instead of reading the marker directly.
 *  - `applyCookiePersistence`: strips maxAge/expires only if sessionOnly
 *    is passed true (kept for tests / defensive callers).
 *  - signIn / signOut delete the leftover marker so it cannot linger.
 */
export const SESSION_ONLY_COOKIE = 'nm_session_only'

export type PersistableCookieOptions = {
  maxAge?: number
  expires?: Date
  [key: string]: unknown
}

export function shouldUseSessionOnlyCookies(_markerPresent: boolean): boolean {
  return false
}

export function applyCookiePersistence<T extends PersistableCookieOptions | undefined>(
  options: T,
  sessionOnly: boolean
): PersistableCookieOptions | undefined {
  if (!options || !sessionOnly) return options
  const { maxAge: _maxAge, expires: _expires, ...rest } = options
  return rest
}
