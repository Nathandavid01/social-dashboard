import { describe, expect, it } from 'vitest'
import {
  POOL_HEALTH_PATH,
  POOL_PATH,
  buildPoolHealth,
  hasSupabasePublicEnv,
  isPoolSmokeHttpOk,
  isPublicHealthPath,
  resolvePoolSmokeBaseUrl,
  shouldSkipPoolHttpSmoke,
} from './pool-smoke'

describe('hasSupabasePublicEnv', () => {
  it('es false sin URL o anon key (CI sin secretos)', () => {
    expect(hasSupabasePublicEnv({})).toBe(false)
    expect(hasSupabasePublicEnv({ NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co' })).toBe(false)
    expect(hasSupabasePublicEnv({ NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon' })).toBe(false)
    expect(
      hasSupabasePublicEnv({
        NEXT_PUBLIC_SUPABASE_URL: '  ',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
      }),
    ).toBe(false)
  })

  it('es true con URL y anon key', () => {
    expect(
      hasSupabasePublicEnv({
        NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
      }),
    ).toBe(true)
  })
})

describe('resolvePoolSmokeBaseUrl / skip', () => {
  it('omite el HTTP smoke si no hay URL de preview/staging', () => {
    expect(resolvePoolSmokeBaseUrl({})).toBeNull()
    expect(shouldSkipPoolHttpSmoke({})).toBe(true)
  })

  it('usa SMOKE_BASE_URL, luego STAGING_BASE_URL, luego PREVIEW_URL', () => {
    expect(resolvePoolSmokeBaseUrl({ SMOKE_BASE_URL: 'https://preview.example/' })).toBe(
      'https://preview.example',
    )
    expect(resolvePoolSmokeBaseUrl({ STAGING_BASE_URL: 'https://staging.example' })).toBe(
      'https://staging.example',
    )
    expect(resolvePoolSmokeBaseUrl({ PREVIEW_URL: 'https://pr.example' })).toBe('https://pr.example')
  })

  it('no pide secretos nuevos: con URL corre aunque falte Supabase', () => {
    expect(
      shouldSkipPoolHttpSmoke({
        SMOKE_BASE_URL: 'https://preview.example',
      }),
    ).toBe(false)
  })
})

describe('isPoolSmokeHttpOk', () => {
  it('falla en 500 (el caso que queremos pillar post-deploy)', () => {
    expect(isPoolSmokeHttpOk(500)).toBe(false)
    expect(isPoolSmokeHttpOk(502)).toBe(false)
    expect(isPoolSmokeHttpOk(503)).toBe(false)
  })

  it('acepta 200, redirect a login y 401/403 (auth-aware)', () => {
    expect(isPoolSmokeHttpOk(200)).toBe(true)
    expect(isPoolSmokeHttpOk(302)).toBe(true)
    expect(isPoolSmokeHttpOk(307)).toBe(true)
    expect(isPoolSmokeHttpOk(401)).toBe(true)
    expect(isPoolSmokeHttpOk(403)).toBe(true)
  })

  it('falla si /pool no existe (404)', () => {
    expect(isPoolSmokeHttpOk(404)).toBe(false)
  })
})

describe('buildPoolHealth', () => {
  it('nunca tira y marca supabase=false sin env', () => {
    const body = buildPoolHealth({})
    expect(body.ok).toBe(true)
    expect(body.route).toBe(POOL_PATH)
    expect(body.supabaseConfigured).toBe(false)
  })

  it('marca supabase=true cuando hay URL y anon', () => {
    const body = buildPoolHealth({
      NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
    })
    expect(body.ok).toBe(true)
    expect(body.supabaseConfigured).toBe(true)
  })
})

describe('isPublicHealthPath', () => {
  it('excluye /api/health/* del middleware (sin env no debe 500)', () => {
    expect(isPublicHealthPath(POOL_HEALTH_PATH)).toBe(true)
    expect(isPublicHealthPath('/api/health')).toBe(true)
    expect(isPublicHealthPath('/pool')).toBe(false)
    expect(isPublicHealthPath('/api/version')).toBe(false)
  })
})
