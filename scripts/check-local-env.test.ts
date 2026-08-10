import { describe, expect, it } from 'vitest'
import { missingLocalEnv } from './check-local-env.mjs'

describe('local environment check', () => {
  it('requires the Supabase URL and anon key', () => {
    expect(missingLocalEnv({})).toEqual([
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    ])
  })

  it('accepts a configured Supabase environment', () => {
    expect(
      missingLocalEnv({
        NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
      }),
    ).toEqual([])
  })

  it('treats blank values as missing', () => {
    expect(
      missingLocalEnv({
        NEXT_PUBLIC_SUPABASE_URL: '  ',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
      }),
    ).toEqual(['NEXT_PUBLIC_SUPABASE_URL'])
  })
})
