/**
 * "Mantener sesión iniciada" support. When the user UNCHECKS the box at login,
 * the auth cookies must be browser-session cookies (die on close) instead of
 * the long-lived ones @supabase/ssr writes by default. Two pieces:
 *
 *  - `SESSION_ONLY_COOKIE`: marker set by the signIn action (itself a session
 *    cookie). While present, every place that writes auth cookies (server
 *    client + middleware token refresh) strips the persistence attributes —
 *    without this, the first token refresh would silently re-persist them.
 *  - `applyCookiePersistence`: strips maxAge/expires when session-only.
 */
export const SESSION_ONLY_COOKIE = 'nm_session_only'

export type PersistableCookieOptions = {
  maxAge?: number
  expires?: Date
  [key: string]: unknown
}

export function applyCookiePersistence<T extends PersistableCookieOptions | undefined>(
  options: T,
  sessionOnly: boolean
): PersistableCookieOptions | undefined {
  if (!options || !sessionOnly) return options
  const { maxAge: _maxAge, expires: _expires, ...rest } = options
  return rest
}
