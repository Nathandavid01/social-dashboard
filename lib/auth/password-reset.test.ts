import { describe, it, expect } from 'vitest'
import { canResetPassword } from './password-reset'

describe('canResetPassword', () => {
  it('lets an owner assign a password to anyone else', () => {
    for (const targetRole of ['owner', 'supervisor', 'editor', 'video', 'copy', 'disenador', 'team_member'] as const) {
      expect(canResetPassword({ actor: 'owner', targetRole, isSelf: false }).ok).toBe(true)
    }
  })

  it('lets a supervisor assign a password only to execution roles', () => {
    for (const targetRole of ['editor', 'video', 'copy', 'disenador', 'team_member'] as const) {
      expect(canResetPassword({ actor: 'supervisor', targetRole, isSelf: false }).ok).toBe(true)
    }
  })

  it('blocks a supervisor from owners and other supervisors', () => {
    expect(canResetPassword({ actor: 'supervisor', targetRole: 'owner', isSelf: false }).ok).toBe(false)
    expect(canResetPassword({ actor: 'supervisor', targetRole: 'supervisor', isSelf: false }).ok).toBe(false)
  })

  it('blocks assigning your own password from this screen', () => {
    const own = canResetPassword({ actor: 'owner', targetRole: 'owner', isSelf: true })
    expect(own.ok).toBe(false)
    if (!own.ok) expect(own.reason).toMatch(/Seguridad/)
    expect(canResetPassword({ actor: 'supervisor', targetRole: 'editor', isSelf: true }).ok).toBe(false)
  })

  it('blocks editors and anyone without an admin role', () => {
    expect(canResetPassword({ actor: 'editor', targetRole: 'video', isSelf: false }).ok).toBe(false)
    expect(canResetPassword({ actor: 'video', targetRole: 'editor', isSelf: false }).ok).toBe(false)
    expect(canResetPassword({ actor: null, targetRole: 'editor', isSelf: false }).ok).toBe(false)
    expect(canResetPassword({ actor: undefined, targetRole: 'editor', isSelf: false }).ok).toBe(false)
  })

  it('blocks a missing target role', () => {
    expect(canResetPassword({ actor: 'owner', targetRole: null, isSelf: false }).ok).toBe(false)
    expect(canResetPassword({ actor: 'supervisor', targetRole: undefined, isSelf: false }).ok).toBe(false)
  })
})
