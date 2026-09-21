import { describe, it, expect, vi } from 'vitest'
import { preflightVideoUploads } from './preflight-video-uploads'
import type { DuplicateVideo } from '@/lib/actions/video-dedupe'

function file(name: string): File {
  return new File(['x'], name, { type: 'video/mp4' })
}

const dup: DuplicateVideo = {
  videoId: 'vid-9',
  kind: 'raw',
  fileName: 'IMG_8841.MOV',
  uploadedAt: '2026-08-28T15:00:00Z',
  ideaId: 'idea-9',
  ideaTitle: 'Intro clínica',
  clientName: 'ARASIBO',
  uploadedBy: 'Carlos',
}

describe('preflightVideoUploads', () => {
  it('sin deps, todos los archivos pasan (fail-open)', async () => {
    const a = file('a.mp4')
    const r = await preflightVideoUploads([a])
    expect(r.fresh).toEqual([a])
    expect(r.blocked).toEqual([])
  })

  it('si la huella ya existe, el archivo no pasa y no se trata como fresco', async () => {
    const a = file('a.mp4')
    const r = await preflightVideoUploads([a], {
      fingerprint: async () => 'v1-1-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      findDuplicate: async () => dup,
    })
    expect(r.fresh).toEqual([])
    expect(r.blocked).toEqual([{ file: a, duplicate: dup }])
  })

  it('mezcla: solo los nuevos quedan frescos', async () => {
    const oldFile = file('old.mp4')
    const newFile = file('new.mp4')
    const r = await preflightVideoUploads([oldFile, newFile], {
      fingerprint: async (f) => (f.name === 'old.mp4' ? 'old' : 'new'),
      findDuplicate: async (fp) => (fp === 'old' ? dup : null),
    })
    expect(r.fresh).toEqual([newFile])
    expect(r.blocked).toHaveLength(1)
    expect(r.blocked[0].file).toBe(oldFile)
  })

  it('si la comprobación falla, el archivo sigue (nunca bloquea un video legítimo)', async () => {
    const a = file('a.mp4')
    const r = await preflightVideoUploads([a], {
      fingerprint: async () => { throw new Error('red') },
      findDuplicate: vi.fn(),
    })
    expect(r.fresh).toEqual([a])
    expect(r.blocked).toEqual([])
  })
})
