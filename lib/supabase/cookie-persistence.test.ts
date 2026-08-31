import { describe, expect, it } from 'vitest'
import { SESSION_ONLY_COOKIE, applyCookiePersistence } from './cookie-persistence'

describe('applyCookiePersistence', () => {
  it('strips maxAge and expires when the session is browser-only', () => {
    const out = applyCookiePersistence(
      { maxAge: 34560000, expires: new Date('2030-01-01'), httpOnly: true, sameSite: 'lax' },
      true
    )
    expect(out).toEqual({ httpOnly: true, sameSite: 'lax' })
  })

  it('returns the options untouched when the session should persist', () => {
    const options = { maxAge: 100, httpOnly: true }
    expect(applyCookiePersistence(options, false)).toEqual({ maxAge: 100, httpOnly: true })
  })

  it('handles undefined options', () => {
    expect(applyCookiePersistence(undefined, true)).toBeUndefined()
    expect(applyCookiePersistence(undefined, false)).toBeUndefined()
  })

  it('exposes the marker cookie name', () => {
    expect(SESSION_ONLY_COOKIE).toBe('nm_session_only')
  })
})
