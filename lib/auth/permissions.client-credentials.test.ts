import { it, expect } from 'vitest'
import { hasPermission } from './permissions'

it('limita los accesos de redes del cliente a owner y supervisor', () => {
  for (const perm of ['clients.credentials.read', 'clients.credentials.edit'] as const) {
    expect(hasPermission('owner', perm)).toBe(true)
    expect(hasPermission('supervisor', perm)).toBe(true)
    for (const role of ['editor', 'video', 'copy', 'disenador', 'team_member'] as const) {
      expect(hasPermission(role, perm)).toBe(false)
    }
  }
})
