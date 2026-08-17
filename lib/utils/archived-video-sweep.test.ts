import { describe, it, expect } from 'vitest'
import { ARCHIVED_VIDEO_GRACE_DAYS, archivedVideoCandidates } from './archived-video-sweep'

const now = new Date('2026-08-15T12:00:00Z')
const oldEnough = '2026-08-08T11:00:00Z'   // > 7 días antes de `now`
const tooRecent = '2026-08-09T00:00:00Z'   // < 7 días antes de `now`

const row = (over: Partial<{
  id: string
  status: string
  storage_provider: string
  drive_file_id: string | null
  updated_at: string
}> = {}) => ({
  id: 'v1',
  status: 'archived',
  storage_provider: 'r2',
  drive_file_id: 'ideas/idea-1/edited/1-final.mp4',
  updated_at: oldEnough,
  ...over,
})

describe('archivedVideoCandidates', () => {
  it('7 días es la gracia documentada', () => {
    expect(ARCHIVED_VIDEO_GRACE_DAYS).toBe(7)
  })

  it('archivada hace más de 7 días, en R2, con objeto → candidata', () => {
    expect(archivedVideoCandidates([row()], now)).toEqual([
      { id: 'v1', driveFileId: 'ideas/idea-1/edited/1-final.mp4' },
    ])
  })

  it('archivada hace MENOS de 7 días → todavía no (dentro de la ventana de deshacer real)', () => {
    expect(archivedVideoCandidates([row({ updated_at: tooRecent })], now)).toEqual([])
  })

  it('no está archivada (uploaded) → nunca candidata, sin importar la fecha', () => {
    expect(archivedVideoCandidates([row({ status: 'uploaded' })], now)).toEqual([])
  })

  it('no está en el bucket del pipeline (storage_provider distinto) → fuera — Entregas solo archiva, este barrido no le toca el archivo', () => {
    expect(archivedVideoCandidates([row({ storage_provider: 'entregas-r2' })], now)).toEqual([])
  })

  it('sin drive_file_id (nada que borrar) → fuera', () => {
    expect(archivedVideoCandidates([row({ drive_file_id: null })], now)).toEqual([])
  })

  it('exactamente 7 días → todavía no es candidata (borde estricto, no destruye en el límite)', () => {
    const exact = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    expect(archivedVideoCandidates([row({ updated_at: exact })], now)).toEqual([])
  })

  it('varias filas: solo selecciona las que cumplen todas las condiciones', () => {
    const rows = [
      row({ id: 'a' }),
      row({ id: 'b', updated_at: tooRecent }),
      row({ id: 'c', status: 'uploaded' }),
      row({ id: 'd', storage_provider: 'drive' }),
      row({ id: 'e', drive_file_id: null }),
    ]
    expect(archivedVideoCandidates(rows, now)).toEqual([
      { id: 'a', driveFileId: 'ideas/idea-1/edited/1-final.mp4' },
    ])
  })
})
