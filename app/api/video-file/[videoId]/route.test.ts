import { describe, it, expect, vi, beforeEach } from 'vitest'

const currentUserHas = vi.fn(async (_perm: string) => true)
vi.mock('@/lib/auth/server', () => ({
  currentUserHas: (perm: string) => currentUserHas(perm),
}))

let videoResult: { data: unknown; error: unknown } = { data: null, error: null }
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: (table: string) => {
      if (table !== 'content_idea_videos') throw new Error(`unexpected table ${table}`)
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => videoResult,
          }),
        }),
      }
    },
  }),
}))

/** Log de cada GetObjectCommand mandado, y a qué "bucket" (via qué client mock). */
let sendCalls: Array<{ bucket: string; input: Record<string, unknown> }> = []
let sendResult: unknown = null
let sendThrows: Error | null = null

function makeClient(bucket: string) {
  return {
    send: async (cmd: { input: Record<string, unknown> }) => {
      sendCalls.push({ bucket, input: cmd.input })
      if (sendThrows) throw sendThrows
      return sendResult
    },
  }
}

vi.mock('@/lib/integrations/r2', () => ({
  r2Client: () => makeClient('pipeline'),
  r2Bucket: () => 'pipeline-bucket',
}))
vi.mock('@/lib/integrations/entregas-r2', () => ({
  entregasR2Client: () => makeClient('entregas'),
  entregasR2Bucket: () => 'entregas-bucket',
}))

vi.mock('@aws-sdk/client-s3', () => ({
  GetObjectCommand: class {
    input: Record<string, unknown>
    constructor(input: Record<string, unknown>) { this.input = input }
  },
}))

import { GET } from './route'

function webStreamOf(text: string): ReadableStream {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text))
      controller.close()
    },
  })
}

function req(headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/video-file/vid-1', { headers })
}

function ctx(videoId = 'vid-1') {
  return { params: Promise.resolve({ videoId }) }
}

beforeEach(() => {
  currentUserHas.mockReset().mockResolvedValue(true)
  videoResult = { data: { drive_file_id: 'key/video.mp4', storage_provider: 'entregas-r2', status: 'uploaded' }, error: null }
  sendCalls = []
  sendThrows = null
  sendResult = {
    Body: { transformToWebStream: () => webStreamOf('bytes') },
    ContentType: 'video/mp4',
    ContentLength: 5,
  }
})

describe('GET /api/video-file/[videoId]', () => {
  it('403 sin ningún permiso de lectura (revision/entregas/planning)', async () => {
    currentUserHas.mockResolvedValue(false)
    const res = await GET(req(), ctx())
    expect(res.status).toBe(403)
    expect(sendCalls).toEqual([])
  })

  it('404 cuando el video no existe', async () => {
    videoResult = { data: null, error: null }
    const res = await GET(req(), ctx())
    expect(res.status).toBe(404)
    expect(sendCalls).toEqual([])
  })

  it('404 cuando el video está archivado/failed', async () => {
    videoResult = { data: { drive_file_id: 'k', storage_provider: 'r2', status: 'archived' }, error: null }
    const res = await GET(req(), ctx())
    expect(res.status).toBe(404)
  })

  it('404 cuando storage_provider no es soportado (p.ej. drive)', async () => {
    videoResult = { data: { drive_file_id: 'k', storage_provider: 'drive', status: 'uploaded' }, error: null }
    const res = await GET(req(), ctx())
    expect(res.status).toBe(404)
    expect(sendCalls).toEqual([])
  })

  it('sin cabecera Range → 200 con el cuerpo completo, sin Content-Range', async () => {
    const res = await GET(req(), ctx())
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('video/mp4')
    expect(res.headers.get('Content-Length')).toBe('5')
    expect(res.headers.get('Content-Range')).toBeNull()
    expect(res.headers.get('Accept-Ranges')).toBe('bytes')
    await expect(res.text()).resolves.toBe('bytes')
    expect(sendCalls).toHaveLength(1)
    expect(sendCalls[0].input.Range).toBeUndefined()
  })

  it('con cabecera Range → la reenvía a R2, y responde 206 con Content-Range del objeto', async () => {
    sendResult = {
      Body: { transformToWebStream: () => webStreamOf('by') },
      ContentType: 'video/mp4',
      ContentLength: 2,
      ContentRange: 'bytes 0-1/5',
    }
    const res = await GET(req({ Range: 'bytes=0-1' }), ctx())
    expect(res.status).toBe(206)
    expect(res.headers.get('Content-Range')).toBe('bytes 0-1/5')
    expect(res.headers.get('Content-Length')).toBe('2')
    expect(sendCalls[0].input.Range).toBe('bytes=0-1')
  })

  it('resuelve por storage_provider: entregas-r2 → bucket/cliente de Entregas', async () => {
    videoResult = { data: { drive_file_id: 'k', storage_provider: 'entregas-r2', status: 'uploaded' }, error: null }
    await GET(req(), ctx())
    expect(sendCalls[0].bucket).toBe('entregas')
    expect(sendCalls[0].input.Bucket).toBe('entregas-bucket')
    expect(sendCalls[0].input.Key).toBe('k')
  })

  it('resuelve por storage_provider: r2 (pipeline) → bucket/cliente del pipeline', async () => {
    videoResult = { data: { drive_file_id: 'k', storage_provider: 'r2', status: 'uploaded' }, error: null }
    await GET(req(), ctx())
    expect(sendCalls[0].bucket).toBe('pipeline')
    expect(sendCalls[0].input.Bucket).toBe('pipeline-bucket')
  })

  it('el GetObjectCommand a R2 falla → 502, sin lanzar', async () => {
    sendThrows = new Error('R2 caído')
    const res = await GET(req(), ctx())
    expect(res.status).toBe(502)
  })

  it('sin body en la respuesta de R2 → 404', async () => {
    sendResult = { Body: undefined, ContentType: 'video/mp4' }
    const res = await GET(req(), ctx())
    expect(res.status).toBe(404)
  })

  it('nunca cachea públicamente (Cache-Control privado/no-store)', async () => {
    const res = await GET(req(), ctx())
    const cc = res.headers.get('Cache-Control') ?? ''
    expect(cc).toMatch(/no-store|private/)
  })

  describe('audit: nunca sirve un tipo ejecutable, sin importar lo que diga R2', () => {
    it('un objeto con Content-Type text/html guardado → se sirve como octet-stream + nosniff + attachment', async () => {
      sendResult = {
        Body: { transformToWebStream: () => webStreamOf('<script>alert(1)</script>') },
        ContentType: 'text/html',
        ContentLength: 26,
      }
      const res = await GET(req(), ctx())
      expect(res.headers.get('Content-Type')).toBe('application/octet-stream')
      expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff')
      expect(res.headers.get('Content-Disposition')).toBe('attachment')
    })

    it('un objeto con Content-Type image/svg+xml guardado → también degrada a octet-stream', async () => {
      sendResult = {
        Body: { transformToWebStream: () => webStreamOf('<svg onload=alert(1)>') },
        ContentType: 'image/svg+xml',
        ContentLength: 22,
      }
      const res = await GET(req(), ctx())
      expect(res.headers.get('Content-Type')).toBe('application/octet-stream')
      expect(res.headers.get('Content-Disposition')).toBe('attachment')
    })

    it('un mp4 normal sigue sirviéndose igual: Content-Type intacto, sin forzar descarga, con nosniff', async () => {
      const res = await GET(req(), ctx())
      expect(res.headers.get('Content-Type')).toBe('video/mp4')
      expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff')
      expect(res.headers.get('Content-Disposition')).toBeNull()
    })

    it('streaming y Range siguen intactos para un mp4 normal', async () => {
      sendResult = {
        Body: { transformToWebStream: () => webStreamOf('by') },
        ContentType: 'video/mp4',
        ContentLength: 2,
        ContentRange: 'bytes 0-1/5',
      }
      const res = await GET(req({ Range: 'bytes=0-1' }), ctx())
      expect(res.status).toBe(206)
      expect(res.headers.get('Content-Range')).toBe('bytes 0-1/5')
      expect(sendCalls[0].input.Range).toBe('bytes=0-1')
    })
  })
})
