import { describe, it, expect } from 'vitest'
import { hasPermission } from './permissions'

describe('planning.assign permission (assigning videos to others)', () => {
  it('owner and supervisor may assign', () => {
    expect(hasPermission('owner', 'planning.assign')).toBe(true)
    expect(hasPermission('supervisor', 'planning.assign')).toBe(true)
  })

  it('editor, video and legacy team_member may NOT assign', () => {
    expect(hasPermission('editor', 'planning.assign')).toBe(false)
    expect(hasPermission('video', 'planning.assign')).toBe(false)
    expect(hasPermission('team_member', 'planning.assign')).toBe(false)
  })

  it('a null role may not assign', () => {
    expect(hasPermission(null, 'planning.assign')).toBe(false)
  })
})
