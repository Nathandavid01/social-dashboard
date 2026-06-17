import { describe, it, expect } from 'vitest'
import { validateNewUser } from './user-admin-core'

const ok = { email: 'nuevo@nmedia.pr', fullName: 'Nuevo Editor', role: 'editor' as const, password: 'secret123' }

describe('validateNewUser', () => {
  it('accepts a complete, valid user', () => {
    expect(validateNewUser(ok)).toEqual({ ok: true })
  })

  it('rejects a malformed email', () => {
    expect(validateNewUser({ ...ok, email: 'no-arroba' })).toEqual({ ok: false, error: expect.stringMatching(/email/i) })
  })

  it('rejects an empty name', () => {
    expect(validateNewUser({ ...ok, fullName: '   ' }).ok).toBe(false)
  })

  it('rejects a non-assignable role (e.g. legacy team_member)', () => {
    expect(validateNewUser({ ...ok, role: 'team_member' as never }).ok).toBe(false)
    expect(validateNewUser({ ...ok, role: 'nope' as never }).ok).toBe(false)
  })

  it('rejects a password shorter than 8 chars', () => {
    expect(validateNewUser({ ...ok, password: 'short' }).ok).toBe(false)
  })

  it('accepts each assignable role (owner/supervisor/editor/video)', () => {
    for (const role of ['owner', 'supervisor', 'editor', 'video'] as const) {
      expect(validateNewUser({ ...ok, role })).toEqual({ ok: true })
    }
  })
})
