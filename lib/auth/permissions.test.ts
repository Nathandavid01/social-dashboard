import { describe, it, expect } from 'vitest'
import { hasPermission } from './permissions'

describe('view_as.editor', () => {
  it('owner (wildcard) y supervisor pueden; el editor no', () => {
    expect(hasPermission('owner', 'view_as.editor')).toBe(true)
    expect(hasPermission('supervisor', 'view_as.editor')).toBe(true)
    expect(hasPermission('editor', 'view_as.editor')).toBe(false)
    expect(hasPermission('copy', 'view_as.editor')).toBe(false)
  })
})

describe('presence.read (tablero Jornada — todo el equipo)', () => {
  it('todos los roles del estudio pueden ver y ser medidos', () => {
    for (const role of ['owner', 'supervisor', 'editor', 'video', 'disenador', 'copy', 'team_member'] as const) {
      expect(hasPermission(role, 'presence.read')).toBe(true)
    }
  })
  it('sin rol: no', () => {
    expect(hasPermission(null, 'presence.read')).toBe(false)
  })
})

describe('recording.brief (brief de On Site)', () => {
  it('owner y supervisor pueden generar y editar el brief', () => {
    expect(hasPermission('owner', 'recording.brief')).toBe(true)
    expect(hasPermission('supervisor', 'recording.brief')).toBe(true)
  })

  it('quien graba no edita el brief', () => {
    expect(hasPermission('video', 'recording.brief')).toBe(false)
    expect(hasPermission('editor', 'recording.brief')).toBe(false)
  })
})

describe('video.upload en el rol video (subir material en On Site)', () => {
  it('el videógrafo puede subir el crudo de cada idea', () => {
    expect(hasPermission('video', 'video.upload')).toBe(true)
  })
})

describe('planning.assign', () => {
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
