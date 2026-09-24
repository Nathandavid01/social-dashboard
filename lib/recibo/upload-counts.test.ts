import { describe, expect, it } from 'vitest'
import { canSeeReciboUploadCounts, currentEntregasEdit, reciboUploadCounts, uploaderSide } from './upload-counts'

const cut = (over: Record<string, unknown> = {}) => ({
  id: 'v',
  kind: 'edited',
  storage_provider: 'entregas-r2',
  status: 'uploaded',
  drive_file_id: 'key',
  uploaded_at: '2026-09-20T00:00:00Z',
  uploaded_by: null,
  uploader: null,
  ...over,
})

describe('uploaderSide', () => {
  it('agrupa por el primer nombre, sin importar mayúsculas', () => {
    expect(uploaderSide('Nathan Torres')).toBe('nathan')
    expect(uploaderSide('nathan test')).toBe('nathan')
    expect(uploaderSide('Eric Perez')).toBe('eric')
    expect(uploaderSide('ERIC')).toBe('eric')
  })

  it('deja en otro un nombre vacío, nulo o de otra persona', () => {
    expect(uploaderSide(null)).toBe('otro')
    expect(uploaderSide('')).toBe('otro')
    expect(uploaderSide('Alexa Kerocen')).toBe('otro')
  })
})

describe('currentEntregasEdit', () => {
  it('usa el corte de Entregas más reciente y deja fuera crudo, archivo viejo y fallido', () => {
    const latest = cut({ id: 'new', uploaded_at: '2026-09-23T00:00:00Z', uploader: { full_name: 'Eric Perez' } })
    const chosen = currentEntregasEdit([
      cut({ id: 'old', uploaded_at: '2026-09-01T00:00:00Z' }),
      cut({ id: 'raw', kind: 'raw', uploaded_at: '2026-09-24T00:00:00Z' }),
      cut({ id: 'gone', status: 'archived', uploaded_at: '2026-09-24T00:00:00Z' }),
      cut({ id: 'bad', status: 'failed', uploaded_at: '2026-09-24T00:00:00Z' }),
      cut({ id: 'nokey', drive_file_id: null, uploaded_at: '2026-09-24T00:00:00Z' }),
      latest,
    ])
    expect(chosen?.id).toBe('new')
  })
})

describe('canSeeReciboUploadCounts', () => {
  it('deja ver el conteo a Eric Perez, Eric, Denisha y Nathan Torres', () => {
    expect(canSeeReciboUploadCounts({ id: '2ec6c260-4ed5-4c4b-8f85-8b76353532cb' })).toBe(true)
    expect(canSeeReciboUploadCounts({ fullName: 'Eric' })).toBe(true)
    expect(canSeeReciboUploadCounts({ fullName: 'Denisha Matos' })).toBe(true)
    expect(canSeeReciboUploadCounts({ fullName: 'Nathan Torres' })).toBe(true)
  })

  it('lo esconde a otra persona y a Nathan Test', () => {
    expect(canSeeReciboUploadCounts(null)).toBe(false)
    expect(canSeeReciboUploadCounts({ fullName: 'Alexa Kerocen' })).toBe(false)
    expect(canSeeReciboUploadCounts({ id: '964999bf-29a3-4599-8776-7251f499b814', fullName: 'Nathan Test' })).toBe(false)
  })
})

describe('reciboUploadCounts', () => {
  it('cuenta el corte visible de cada idea: Nathan, Eric y sin autor', () => {
    const counts = reciboUploadCounts([
      { videos: [cut({ uploader: { full_name: 'Nathan Torres' } })] },
      { videos: [cut({ uploader: { full_name: 'Eric Perez' } }), cut({ id: 'old', uploaded_at: '2026-01-01T00:00:00Z', uploader: { full_name: 'Nathan Torres' } })] },
      { videos: [cut()] },
      { videos: [] },
    ])
    expect(counts).toEqual({ nathan: 1, eric: 1, otro: 1, total: 3 })
  })
})
