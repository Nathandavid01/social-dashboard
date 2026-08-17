import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const fromSpy = vi.fn(() => {
  throw new Error('no debería llamarse a Supabase sin autorización')
})
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: fromSpy })),
}))
const r2Send = vi.fn(async () => ({}))
vi.mock('@/lib/integrations/r2', () => ({
  r2PublicUrl: vi.fn(() => 'https://x/y'),
  r2Client: vi.fn(() => ({ send: r2Send })),
  r2Bucket: vi.fn(() => 'nmedia-videos'),
}))
vi.mock('@aws-sdk/client-s3', () => ({
  DeleteObjectCommand: vi.fn((input: unknown) => ({ input })),
}))
vi.mock('@/lib/integrations/video-health', () => ({ checkVideoPlayable: vi.fn(async () => ({ ok: true })) }))
vi.mock('@/lib/utils/video-analysis-sweep', () => ({ staleAnalysisCandidates: vi.fn(() => []) }))
vi.mock('@/lib/utils/archived-video-sweep', () => ({ archivedVideoCandidates: vi.fn(() => []) }))

import type { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import { archivedVideoCandidates } from '@/lib/utils/archived-video-sweep'
import { GET } from './route'

function req(headers: Record<string, string> = {}): NextRequest {
  return new Request('http://localhost/api/cron/video-health', { headers }) as unknown as NextRequest
}

beforeEach(() => {
  fromSpy.mockClear()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('GET /api/cron/video-health — mismo gate de CRON_SECRET', () => {
  it('sin cabecera → 401, no consulta Supabase', async () => {
    vi.stubEnv('CRON_SECRET', 'secreto-real')
    const res = await GET(req())
    expect(res.status).toBe(401)
    expect(fromSpy).not.toHaveBeenCalled()
  })

  it('x-vercel-cron solo, sin Bearer → 401', async () => {
    vi.stubEnv('CRON_SECRET', 'secreto-real')
    const res = await GET(req({ 'x-vercel-cron': '1' }))
    expect(res.status).toBe(401)
    expect(fromSpy).not.toHaveBeenCalled()
  })

  it('sin CRON_SECRET en el entorno → 503, no ejecuta', async () => {
    vi.stubEnv('CRON_SECRET', '')
    const res = await GET(req({ Authorization: 'Bearer x' }))
    expect(res.status).toBe(503)
    expect(fromSpy).not.toHaveBeenCalled()
  })
})

describe('GET /api/cron/video-health — barrido diferido de archivados (7 días)', () => {
  type Row = { data: unknown; error: null }
  const queues: Record<string, Row[]> = {}
  const updates: { table: string; payload: unknown }[] = []
  function enqueue(table: string, data: unknown) {
    ;(queues[table] ??= []).push({ data, error: null })
  }
  function makeChain(table: string, isUpdate: boolean, payload?: unknown) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chain: any = {}
    for (const m of ['select', 'eq', 'neq', 'gte', 'order', 'limit']) chain[m] = vi.fn(() => chain)
    if (isUpdate) updates.push({ table, payload })
    chain.then = (resolve: (v: Row) => unknown) => {
      const q = queues[table]
      const next = q && q.length ? q.shift()! : { data: isUpdate ? null : [], error: null }
      return resolve(next)
    }
    return chain
  }

  beforeEach(() => {
    for (const k of Object.keys(queues)) delete queues[k]
    updates.length = 0
    vi.mocked(createClient).mockReturnValue({
      from: vi.fn((table: string) => ({
        select: vi.fn(() => makeChain(table, false)),
        update: vi.fn((payload: unknown) => makeChain(table, true, payload)),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      })) as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    vi.mocked(archivedVideoCandidates).mockReset()
    r2Send.mockClear()
    vi.mocked(DeleteObjectCommand).mockClear()
    vi.stubEnv('CRON_SECRET', 'secreto-real')
    // One playable edited video keeps the route past its early-return so the
    // best-effort sweeps below actually run.
    enqueue('content_idea_videos', [{ id: 'm1', drive_file_id: 'ideas/x/edited/1.mp4', updated_at: '2026-08-15T00:00:00Z' }])
    enqueue('content_idea_videos', []) // QC-sweep "edited" select — nothing stale
    enqueue('content_idea_video_analysis', []) // QC-sweep analyses select
    enqueue('content_idea_videos', []) // archived select (candidates come from the mocked pure fn)
  })

  it('borra en R2 cada candidato y limpia su drive_file_id, sin tocar el status', async () => {
    vi.mocked(archivedVideoCandidates).mockReturnValue([
      { id: 'v-old-1', driveFileId: 'ideas/idea-1/edited/old.mp4' },
    ])

    const res = await GET(req({ Authorization: 'Bearer secreto-real' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.archivedSwept).toBe(1)
    expect(DeleteObjectCommand).toHaveBeenCalledWith({ Bucket: 'nmedia-videos', Key: 'ideas/idea-1/edited/old.mp4' })
    expect(r2Send).toHaveBeenCalledTimes(1)
    expect(updates).toContainEqual({
      table: 'content_idea_videos',
      payload: { drive_file_id: null },
    })
  })

  it('sin candidatos (nada archivado hace más de 7 días) → no borra nada en R2', async () => {
    vi.mocked(archivedVideoCandidates).mockReturnValue([])

    const res = await GET(req({ Authorization: 'Bearer secreto-real' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.archivedSwept).toBe(0)
    expect(r2Send).not.toHaveBeenCalled()
  })

  it('un fallo al borrar un candidato no tumba la respuesta del health-check', async () => {
    vi.mocked(archivedVideoCandidates).mockReturnValue([
      { id: 'v-fail', driveFileId: 'ideas/idea-1/edited/fail.mp4' },
    ])
    r2Send.mockRejectedValueOnce(new Error('R2 caído'))

    const res = await GET(req({ Authorization: 'Bearer secreto-real' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.archivedSwept).toBe(0)
  })
})
