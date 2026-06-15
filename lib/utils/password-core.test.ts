import { describe, it, expect } from 'vitest'
import { validatePasswordChange, validateNewPassword } from './password-core'

const ok = { current: 'oldpass123', next: 'newpass456', confirm: 'newpass456' }

describe('validateNewPassword (admin-set / reset)', () => {
  it('accepts a password of at least 8 chars', () => {
    expect(validateNewPassword('secret12')).toEqual({ ok: true })
  })
  it('rejects a short or empty password', () => {
    expect(validateNewPassword('short').ok).toBe(false)
    expect(validateNewPassword('').ok).toBe(false)
    expect(validateNewPassword(null).ok).toBe(false)
    expect(validateNewPassword(undefined).ok).toBe(false)
  })
})

describe('validatePasswordChange', () => {
  it('accepts a valid change', () => {
    expect(validatePasswordChange(ok)).toEqual({ ok: true })
  })

  it('requires the current password', () => {
    expect(validatePasswordChange({ ...ok, current: '' }).ok).toBe(false)
  })

  it('rejects a new password shorter than 8 chars', () => {
    expect(validatePasswordChange({ ...ok, next: 'short', confirm: 'short' }).ok).toBe(false)
  })

  it('rejects when confirmation does not match', () => {
    expect(validatePasswordChange({ ...ok, confirm: 'different' })).toEqual({
      ok: false,
      error: expect.stringMatching(/no coinciden/i),
    })
  })

  it('rejects reusing the current password', () => {
    expect(validatePasswordChange({ current: 'samepass1', next: 'samepass1', confirm: 'samepass1' })).toEqual({
      ok: false,
      error: expect.stringMatching(/diferente/i),
    })
  })
})
