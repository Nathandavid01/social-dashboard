import { describe, expect, it } from 'vitest'
import {
  applySignedPoolCaratula,
  isSafePoolPosterKey,
  poolPosterObjectKey,
  resolvePoolCaratula,
  type PoolVideoCoverInput,
} from './pool-caratula'

function video(over: Partial<PoolVideoCoverInput> & Pick<PoolVideoCoverInput, 'id'>): PoolVideoCoverInput {
  return {
    kind: 'edited',
    status: 'uploaded',
    drive_thumb_url: null,
    thumb_keys: null,
    storage_provider: 'entregas-r2',
    drive_file_id: 'ideas/i1/edited/cut.mp4',
    ...over,
  }
}

describe('resolvePoolCaratula — carátula real del panel', () => {
  it('prefiere drive_thumb_url del editado (campo de thumbnail existente)', () => {
    const resolved = resolvePoolCaratula([
      video({
        id: 'raw',
        kind: 'raw',
        drive_thumb_url: 'https://cdn.example/raw.jpg',
        storage_provider: 'r2',
      }),
      video({
        id: 'ed',
        kind: 'edited',
        drive_thumb_url: 'https://cdn.example/edit.jpg',
      }),
    ])
    expect(resolved).toEqual({
      coverUrl: 'https://cdn.example/edit.jpg',
      coverVideoId: 'ed',
      coverThumb: null,
    })
  })

  it('si no hay URL, usa el primer thumb_key del editado (R2 / Entregas, sin FK nueva)', () => {
    const resolved = resolvePoolCaratula([
      video({
        id: 'raw',
        kind: 'raw',
        thumb_keys: ['ideas/i1/raw/thumbs/0.jpg'],
        storage_provider: 'r2',
        drive_file_id: 'ideas/i1/raw/clip.mp4',
      }),
      video({
        id: 'ed',
        kind: 'edited',
        thumb_keys: ['ideas/i1/edited/thumbs/0.jpg', 'ideas/i1/edited/thumbs/1.jpg'],
        storage_provider: 'entregas-r2',
      }),
    ])
    expect(resolved.coverUrl).toBeNull()
    expect(resolved.coverThumb).toEqual({
      videoId: 'ed',
      key: 'ideas/i1/edited/thumbs/0.jpg',
      storageProvider: 'entregas-r2',
    })
    expect(resolved.coverVideoId).toBe('ed')
  })

  it('sin thumbnail cae al video editado para extraer el frame (poster)', () => {
    const resolved = resolvePoolCaratula([
      video({ id: 'raw', kind: 'raw', storage_provider: 'r2' }),
      video({ id: 'ed', kind: 'edited' }),
    ])
    expect(resolved).toEqual({
      coverUrl: null,
      coverVideoId: 'ed',
      coverThumb: null,
    })
  })

  it('ignora archivados/fallidos y no inventa carátula', () => {
    expect(resolvePoolCaratula([
      video({ id: 'dead', status: 'archived', drive_thumb_url: 'https://cdn.example/dead.jpg' }),
      video({ id: 'fail', status: 'failed', thumb_keys: ['k.jpg'] }),
    ])).toEqual({
      coverUrl: null,
      coverVideoId: null,
      coverThumb: null,
    })
  })

  it('si solo hay crudo, usa su thumb_key (mismo video, bucket r2)', () => {
    const resolved = resolvePoolCaratula([
      video({
        id: 'raw',
        kind: 'raw',
        thumb_keys: ['ideas/i1/raw/thumbs/0.jpg'],
        storage_provider: 'r2',
      }),
    ])
    expect(resolved.coverThumb).toEqual({
      videoId: 'raw',
      key: 'ideas/i1/raw/thumbs/0.jpg',
      storageProvider: 'r2',
    })
  })
})

describe('applySignedPoolCaratula', () => {
  it('deja la URL existente y no pide VideoCover', () => {
    expect(applySignedPoolCaratula({
      coverUrl: 'https://cdn.example/edit.jpg',
      coverVideoId: 'ed',
      coverThumb: null,
    }, {})).toEqual({ coverUrl: 'https://cdn.example/edit.jpg', coverVideoId: null })
  })

  it('usa la URL firmada del thumb_key y oculta el id de extract', () => {
    expect(applySignedPoolCaratula({
      coverUrl: null,
      coverVideoId: 'ed',
      coverThumb: { videoId: 'ed', key: 'k.jpg', storageProvider: 'entregas-r2' },
    }, { ed: 'https://signed.example/k.jpg' })).toEqual({
      coverUrl: 'https://signed.example/k.jpg',
      coverVideoId: null,
    })
  })

  it('si el presign falla, deja coverVideoId para extraer el frame', () => {
    expect(applySignedPoolCaratula({
      coverUrl: null,
      coverVideoId: 'ed',
      coverThumb: { videoId: 'ed', key: 'k.jpg', storageProvider: 'entregas-r2' },
    }, {})).toEqual({ coverUrl: null, coverVideoId: 'ed' })
  })
})

describe('poster key — mismo video, sin FK Dual-R2', () => {
  it('guarda el poster junto al mp4, no en otra idea', () => {
    expect(poolPosterObjectKey('ideas/i1/edited/cut.mp4')).toBe('ideas/i1/edited/thumbs/poster.jpg')
  })

  it('rechaza keys de otro video o de otro bucket path', () => {
    const file = 'ideas/i1/edited/cut.mp4'
    expect(isSafePoolPosterKey(file, 'ideas/i1/edited/thumbs/poster.jpg')).toBe(true)
    expect(isSafePoolPosterKey(file, 'ideas/i1/edited/thumbs/0.jpg')).toBe(true)
    expect(isSafePoolPosterKey(file, 'ideas/OTHER/edited/thumbs/poster.jpg')).toBe(false)
    expect(isSafePoolPosterKey(file, 'ideas/i1/raw/thumbs/poster.jpg')).toBe(false)
  })
})
