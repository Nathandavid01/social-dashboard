import { describe, expect, it } from 'vitest'
import { currentEditedVideoId } from './current-edited-video'

const cut = (id: string, uploaded_at: string, status = 'uploaded') => ({ id, uploaded_at, status })

describe('currentEditedVideoId', () => {
  it('es el corte subido más reciente: el que la pantalla enseña', () => {
    expect(
      currentEditedVideoId([cut('viejo', '2026-08-01T10:00:00Z'), cut('nuevo', '2026-08-20T10:00:00Z')]),
    ).toBe('nuevo')
  })

  it('ignora los archivados y fallidos', () => {
    expect(
      currentEditedVideoId([
        cut('archivado', '2026-08-25T10:00:00Z', 'archived'),
        cut('fallido', '2026-08-24T10:00:00Z', 'failed'),
        cut('bueno', '2026-08-01T10:00:00Z'),
      ]),
    ).toBe('bueno')
  })

  it('sin cortes vivos no devuelve nada', () => {
    expect(currentEditedVideoId([])).toBeNull()
    expect(currentEditedVideoId([cut('x', '2026-08-01T10:00:00Z', 'archived')])).toBeNull()
  })

  it('sin fecha de subida no gana por accidente', () => {
    expect(
      currentEditedVideoId([{ id: 'sin-fecha', uploaded_at: null, status: 'uploaded' }, cut('con-fecha', '2026-08-01T10:00:00Z')]),
    ).toBe('con-fecha')
  })

  it('tolera una lista ausente', () => {
    expect(currentEditedVideoId(undefined)).toBeNull()
    expect(currentEditedVideoId(null)).toBeNull()
  })
})
