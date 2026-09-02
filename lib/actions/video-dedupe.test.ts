import { describe, it, expect, vi, beforeEach } from 'vitest'

const requirePermission = vi.fn(async () => {})
vi.mock('@/lib/auth/server', () => ({ requirePermission: () => requirePermission() }))

let lookupRow: Record<string, unknown> | null = null
let videoRow: Record<string, unknown> | null = null
let lookupError: { code?: string; message: string } | null = null
let inserted: Record<string, unknown> | null = null
let insertError: { code?: string; message: string } | null = null
const supa = {
  from: vi.fn((table: string) => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      maybeSingle: async () =>
        table === 'content_idea_video_fingerprints'
          ? { data: lookupRow, error: lookupError }
          : { data: videoRow, error: null },
      insert: async (row: Record<string, unknown>) => { inserted = row; return { error: insertError } },
    }
    return chain
  }),
}
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => supa }))

import { findDuplicateVideo, rememberVideoFingerprint } from './video-dedupe'

beforeEach(() => {
  lookupRow = null; videoRow = null; lookupError = null; inserted = null; insertError = null
  requirePermission.mockReset().mockResolvedValue(undefined)
  supa.from.mockClear()
})

describe('findDuplicateVideo', () => {
  it('devuelve el video existente con idea, cliente y fecha cuando la huella ya está', async () => {
    lookupRow = { video_id: 'vid-1' }
    videoRow = {
      fingerprint: 'v1-10-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', created_at: '2026-08-28T15:00:00Z',
      id: 'vid-1', name: 'final.mp4', kind: 'edited', status: 'uploaded', uploaded_at: '2026-08-28T15:00:00Z',
      idea: { id: 'idea-1', title: 'Intro clínica', client: { id: 'c1', name: 'ARASIBO' } },
      uploader: { full_name: 'Carlos' },
    }
    const res = await findDuplicateVideo('v1-10-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
    expect(res).toEqual({
      videoId: 'vid-1', kind: 'edited', fileName: 'final.mp4', uploadedAt: '2026-08-28T15:00:00Z',
      ideaId: 'idea-1', ideaTitle: 'Intro clínica', clientName: 'ARASIBO', uploadedBy: 'Carlos',
    })
  })

  it('null cuando no hay huella igual', async () => {
    expect(await findDuplicateVideo('v1-10-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')).toBeNull()
  })

  it('null (no bloquea la subida) si la tabla todavía no existe o falla la consulta', async () => {
    lookupError = { code: '42P01', message: 'relation does not exist' }
    expect(await findDuplicateVideo('v1-10-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')).toBeNull()
  })

  it('ignora huellas malformadas sin consultar', async () => {
    expect(await findDuplicateVideo('')).toBeNull()
    expect(await findDuplicateVideo('hola')).toBeNull()
    expect(supa.from).not.toHaveBeenCalled()
  })

  it('exige permiso de subir video', async () => {
    requirePermission.mockRejectedValueOnce(new Error('No autorizado'))
    expect(await findDuplicateVideo('v1-10-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')).toBeNull()
  })
})

describe('rememberVideoFingerprint', () => {
  it('guarda huella → video con su tamaño', async () => {
    const res = await rememberVideoFingerprint({ fingerprint: 'v1-10-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', videoId: 'vid-9', sizeBytes: 10 })
    expect(res).toEqual({ ok: true })
    expect(inserted).toEqual({ fingerprint: 'v1-10-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', video_id: 'vid-9', size_bytes: 10 })
  })

  it('si la huella ya existe (carrera) devuelve duplicate:true sin romper', async () => {
    insertError = { code: '23505', message: 'duplicate key' }
    expect(await rememberVideoFingerprint({ fingerprint: 'v1-10-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', videoId: 'vid-9', sizeBytes: 10 })).toEqual({ ok: false, duplicate: true })
  })

  it('cualquier otro error (tabla ausente) se traga: el video ya está registrado', async () => {
    insertError = { code: '42P01', message: 'relation does not exist' }
    expect(await rememberVideoFingerprint({ fingerprint: 'v1-10-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', videoId: 'vid-9', sizeBytes: 10 })).toEqual({ ok: false })
  })
})
