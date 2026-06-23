import { describe, it, expect } from 'vitest'
import worker, { rangeBounds } from './r2-public-edited-worker.js'

const SIZE = 3_991_256

const EDITED_KEY = 'ideas/abc/edited/123-final.mp4'

/** Minimal stand-in for an R2 bucket binding. */
function mockEnv(size = SIZE) {
  return {
    VIDEOS: {
      async get(_key: string, opts?: { range?: Headers }) {
        const hasRange = !!opts?.range?.get('range')
        return {
          body: 'BYTES',
          size,
          httpEtag: '"etag123"',
          writeHttpMetadata(h: Headers) {
            h.set('content-type', 'video/mp4')
          },
          range: hasRange ? { offset: 0, length: 2 } : undefined,
        }
      },
    },
  }
}

function req(url: string, init?: RequestInit) {
  return new Request(`https://videos.example${url}`, init)
}

describe('rangeBounds', () => {
  it('bytes=0-1023 → start 0, len 1024', () => {
    // R2 parses `bytes=0-1023` into { offset: 0, length: 1024 }
    expect(rangeBounds({ offset: 0, length: 1024 }, SIZE)).toEqual({ start: 0, len: 1024 })
  })

  it('open-ended `bytes=1000-` → from offset to end of object', () => {
    expect(rangeBounds({ offset: 1000 }, SIZE)).toEqual({ start: 1000, len: SIZE - 1000 })
  })

  it('suffix `bytes=-500` → last 500 bytes', () => {
    expect(rangeBounds({ suffix: 500 }, SIZE)).toEqual({ start: SIZE - 500, len: 500 })
  })

  it('suffix larger than object clamps to full object', () => {
    expect(rangeBounds({ suffix: SIZE + 1000 }, SIZE)).toEqual({ start: 0, len: SIZE })
  })

  it('content-range end is inclusive (start + len - 1)', () => {
    const { start, len } = rangeBounds({ offset: 0, length: 1024 }, SIZE)
    expect(`bytes ${start}-${start + len - 1}/${SIZE}`).toBe(`bytes 0-1023/${SIZE}`)
  })
})

describe('worker.fetch — Range + CORS contract (no debe regresar)', () => {
  it('Range request → 206 + Content-Range + Accept-Ranges + CORS', async () => {
    const r = await worker.fetch(req(`/${EDITED_KEY}`, { headers: { Range: 'bytes=0-1' } }), mockEnv())
    expect(r.status).toBe(206)
    expect(r.headers.get('content-range')).toBe(`bytes 0-1/${SIZE}`)
    expect(r.headers.get('content-length')).toBe('2')
    expect(r.headers.get('accept-ranges')).toBe('bytes')
    expect(r.headers.get('access-control-allow-origin')).toBe('*')
  })

  it('GET sin Range → 200 con Accept-Ranges y content-length completo', async () => {
    const r = await worker.fetch(req(`/${EDITED_KEY}`), mockEnv())
    expect(r.status).toBe(200)
    expect(r.headers.get('accept-ranges')).toBe('bytes')
    expect(r.headers.get('content-length')).toBe(String(SIZE))
  })

  it('OPTIONS preflight → 204 con headers CORS', async () => {
    const r = await worker.fetch(req(`/${EDITED_KEY}`, { method: 'OPTIONS' }), mockEnv())
    expect(r.status).toBe(204)
    expect(r.headers.get('access-control-allow-methods')).toContain('GET')
  })

  it('key fuera de /edited/ → 404 (raw sigue privado)', async () => {
    const r = await worker.fetch(req('/ideas/abc/raw/1-clip.mp4'), mockEnv())
    expect(r.status).toBe(404)
  })

  it('path traversal → 404', async () => {
    const r = await worker.fetch(req('/ideas/abc/edited/../../secret.mp4'), mockEnv())
    expect(r.status).toBe(404)
  })
})
