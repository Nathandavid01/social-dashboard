import { describe, expect, it } from 'vitest'
import { resolveRolePreview } from './role-preview-core'

describe('resolveRolePreview', () => {
  it('lets an owner preview the editor role outside production', () => {
    expect(resolveRolePreview('owner', 'editor', false)).toBe('editor')
  })

  it('ignores preview cookies for non-owner accounts', () => {
    expect(resolveRolePreview('supervisor', 'editor', false)).toBeNull()
  })

  it('disables role preview in production', () => {
    expect(resolveRolePreview('owner', 'editor', true)).toBeNull()
  })

  it('rejects owner and invalid role values as preview targets', () => {
    expect(resolveRolePreview('owner', 'owner', false)).toBeNull()
    expect(resolveRolePreview('owner', 'admin', false)).toBeNull()
  })
})
