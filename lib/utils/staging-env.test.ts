import { describe, it, expect } from 'vitest'
import { STAGING_PROJECT_REF, assertStagingUrl, parseDotEnv, stagingBootError } from './staging-env'

describe('assertStagingUrl', () => {
  it('accepts the natemedia-staging project and rejects production', () => {
    expect(() =>
      assertStagingUrl(`https://${STAGING_PROJECT_REF}.supabase.co`),
    ).not.toThrow()
    expect(() => assertStagingUrl('https://uvphfpqeevmhqmyorhcm.supabase.co')).toThrow(
      /producción|production|staging/i,
    )
    expect(() => assertStagingUrl('')).toThrow()
  })
})

describe('stagingBootError', () => {
  it('refuses a missing file or a production URL', () => {
    expect(stagingBootError({ envFileExists: false, supabaseUrl: '' })).toMatch(/\.env\.staging/)
    expect(
      stagingBootError({ envFileExists: true, supabaseUrl: 'https://bgqdtfhelknmfudcvrzz.supabase.co' }),
    ).toMatch(/staging/i)
    expect(
      stagingBootError({
        envFileExists: true,
        supabaseUrl: `https://${STAGING_PROJECT_REF}.supabase.co`,
      }),
    ).toBeNull()
  })
})

describe('parseDotEnv', () => {
  it('reads KEY=value and ignores comments and blanks', () => {
    const parsed = parseDotEnv('# hi\nFOO=bar\n\nBAZ=qux extra\n')
    expect(parsed).toEqual({ FOO: 'bar', BAZ: 'qux extra' })
  })
})
