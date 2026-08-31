import { describe, expect, it } from 'vitest'
import { hasPermission } from './permissions'

/**
 * Banco de Video (/banco): vista global de crudos, SOLO admins.
 * Los admins entran por rol (owner + supervisor); editor y videógrafo no la ven.
 */
describe('video_bank.read', () => {
  it('owner y supervisor pueden ver el banco', () => {
    expect(hasPermission('owner', 'video_bank.read')).toBe(true)
    expect(hasPermission('supervisor', 'video_bank.read')).toBe(true)
  })

  it('editor, videógrafo y legacy team_member NO ven el banco', () => {
    expect(hasPermission('editor', 'video_bank.read')).toBe(false)
    expect(hasPermission('video', 'video_bank.read')).toBe(false)
    expect(hasPermission('team_member', 'video_bank.read')).toBe(false)
  })

  it('sin rol no hay acceso', () => {
    expect(hasPermission(null, 'video_bank.read')).toBe(false)
  })
})
