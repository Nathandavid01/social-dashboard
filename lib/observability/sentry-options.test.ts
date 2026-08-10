import { describe, expect, it } from 'vitest'
import { buildSentryOptions } from './sentry-options'

describe('buildSentryOptions', () => {
  it('stays disabled when no DSN is configured', () => {
    expect(buildSentryOptions({ nodeEnv: 'production' })).toMatchObject({
      dsn: undefined,
      enabled: false,
      environment: 'production',
      tracesSampleRate: 0.1,
      sampleRate: 1,
      sendDefaultPii: false,
    })
  })

  it('enables monitoring when a DSN is present', () => {
    expect(buildSentryOptions({
      dsn: 'https://public@example.ingest.sentry.io/123',
      nodeEnv: 'development',
      release: 'commit-sha',
    })).toMatchObject({
      enabled: true,
      environment: 'development',
      release: 'commit-sha',
      tracesSampleRate: 1,
    })
  })

  it('honors an explicit disable and validates trace sample rates', () => {
    expect(buildSentryOptions({ dsn: 'https://dsn', enabled: 'false' }).enabled).toBe(false)
    expect(buildSentryOptions({ dsn: 'https://dsn', tracesSampleRate: '0.25' }).tracesSampleRate).toBe(0.25)
    expect(buildSentryOptions({ dsn: 'https://dsn', tracesSampleRate: '2' }).tracesSampleRate).toBe(1)
    expect(buildSentryOptions({ dsn: 'https://dsn', tracesSampleRate: 'not-a-number' }).tracesSampleRate).toBe(1)
  })
})
