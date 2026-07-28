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

describe('captions.use / captions.edit (AI captions on the video card)', () => {
  it('el videógrafo YA NO escribe captions: su trabajo es grabar', () => {
    expect(hasPermission('video', 'captions.use')).toBe(false)
    expect(hasPermission('video', 'captions.edit')).toBe(false)
  })

  it('el diseñador entrega piezas pero no escribe el copy', () => {
    expect(hasPermission('disenador', 'video.upload')).toBe(true)
    expect(hasPermission('disenador', 'captions.edit')).toBe(false)
  })

  it('owner, supervisor and editor keep caption access', () => {
    for (const role of ['owner', 'supervisor', 'editor'] as const) {
      expect(hasPermission(role, 'captions.use')).toBe(true)
      expect(hasPermission(role, 'captions.edit')).toBe(true)
    }
  })

  it('a null role has no caption access', () => {
    expect(hasPermission(null, 'captions.use')).toBe(false)
    expect(hasPermission(null, 'captions.edit')).toBe(false)
  })
})
