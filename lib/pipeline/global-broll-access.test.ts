import { describe, expect, it } from 'vitest'
import { canDownloadIdeaVideo } from './editor-video-bank'

/**
 * Acceso global a b-roll: cualquier rol autenticado del equipo puede ver/bajar
 * b-roll de cualquier cliente. REGRESIÓN: el raw ajeno sigue bloqueado — el
 * editor solo baja el raw de SU asignación (y dentro de su WIP).
 */
describe('canDownloadIdeaVideo', () => {
  const foreign = {
    role: 'editor' as const,
    userId: 'e1',
    ideaAssigneeId: 'e2',
    clientAssigneeId: null,
    uploadedBy: 'someone',
    inEditorWip: false,
  }

  it('b-roll ajeno → SÍ para editor (pool global)', () => {
    expect(canDownloadIdeaVideo(foreign, 'broll')).toBe(true)
  })

  it('REGRESIÓN: raw ajeno → NO para editor, aunque sea b-roll para otros roles', () => {
    expect(canDownloadIdeaVideo(foreign, 'raw')).toBe(false)
    expect(canDownloadIdeaVideo(foreign, undefined)).toBe(false)
  })

  it('sin sesión (rol null) no baja nada, ni b-roll', () => {
    expect(canDownloadIdeaVideo({ ...foreign, role: null, userId: null }, 'broll')).toBe(false)
  })

  it('el raw propio dentro del WIP sigue funcionando igual', () => {
    expect(
      canDownloadIdeaVideo(
        { role: 'editor', userId: 'e1', ideaAssigneeId: 'e1', clientAssigneeId: null, uploadedBy: null, inEditorWip: true },
        'raw',
      ),
    ).toBe(true)
  })
})
