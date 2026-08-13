import { describe, it, expect } from 'vitest'
import { STAGING_PROJECT_REF, assertStagingUrl, parseDotEnv } from './staging-env'

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

describe('parseDotEnv', () => {
  it('reads KEY=value and ignores comments and blanks', () => {
    const parsed = parseDotEnv('# hi\nFOO=bar\n\nBAZ=qux extra\n')
    expect(parsed).toEqual({ FOO: 'bar', BAZ: 'qux extra' })
  })
})
