import { describe, expect, it } from 'vitest'
import { isRecoveryLink, recoveryTokensFromHref } from './recovery-core'

describe('isRecoveryLink', () => {
  it('recognizes Supabase recovery tokens in the URL hash', () => {
    expect(isRecoveryLink('http://localhost:3020/#access_token=token&type=recovery')).toBe(true)
  })

  it('recognizes code-based recovery links in the query string', () => {
    expect(isRecoveryLink('http://localhost:3020/update-password?code=abc&type=recovery')).toBe(true)
  })

  it('does not treat a normal login URL as a recovery link', () => {
    expect(isRecoveryLink('http://localhost:3020/login')).toBe(false)
  })

  it('extracts both tokens required to establish a recovery session', () => {
    expect(
      recoveryTokensFromHref('http://localhost:3020/#access_token=access&refresh_token=refresh&type=recovery'),
    ).toEqual({ accessToken: 'access', refreshToken: 'refresh' })
  })
})
