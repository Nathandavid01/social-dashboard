/**
 * Smoke / health helpers for Panel (`/pool`).
 * Pure: no Supabase client, no secrets. CI can skip HTTP when there is no
 * preview URL; the health payload never throws if env is missing.
 */

export const POOL_PATH = '/pool'
export const POOL_HEALTH_PATH = '/api/health/pool'

export type EnvLike = Record<string, string | undefined>

export function hasSupabasePublicEnv(env: EnvLike = process.env): boolean {
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL?.trim() && env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim())
}

export function resolvePoolSmokeBaseUrl(env: EnvLike = process.env): string | null {
  const raw =
    env.SMOKE_BASE_URL?.trim() ||
    env.STAGING_BASE_URL?.trim() ||
    env.PREVIEW_URL?.trim()
  if (raw) return raw.replace(/\/$/, '')
  const vercel = env.VERCEL_URL?.trim()
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//, '')
    return `https://${host}`
  }
  return null
}

export function shouldSkipPoolHttpSmoke(env: EnvLike = process.env): boolean {
  return !resolvePoolSmokeBaseUrl(env)
}

/** Auth-aware: login redirect / 401 is OK. 5xx and missing route are not. */
export function isPoolSmokeHttpOk(status: number): boolean {
  if (status >= 500) return false
  if (status === 200 || status === 204) return true
  if (status === 301 || status === 302 || status === 303 || status === 307 || status === 308) {
    return true
  }
  if (status === 401 || status === 403) return true
  return false
}

export type PoolHealthBody = {
  ok: true
  route: typeof POOL_PATH
  supabaseConfigured: boolean
}

export function buildPoolHealth(env: EnvLike = process.env): PoolHealthBody {
  return {
    ok: true,
    route: POOL_PATH,
    supabaseConfigured: hasSupabasePublicEnv(env),
  }
}

/** Middleware must not touch these paths — missing Supabase URL would 500. */
export function isPublicHealthPath(pathname: string): boolean {
  return pathname === '/api/health' || pathname.startsWith('/api/health/')
}
