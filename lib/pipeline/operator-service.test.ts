import { beforeEach, describe, expect, it, vi } from 'vitest'

const r2State = { configured: true }
vi.mock('@/lib/integrations/r2', () => ({
  r2Client: () => (r2State.configured ? { send: vi.fn() } : null),
  r2Bucket: () => 'nmedia-videos',
  isR2Configured: () => r2State.configured,
}))
vi.mock('@/lib/integrations/entregas-r2', () => ({
  entregasR2Client: () => {
    throw new Error('el operador no usa Entregas')
  },
  entregasR2Bucket: () => 'entregas',
  isEntregasR2Configured: () => {
    throw new Error('el operador no usa Entregas')
  },
}))
vi.mock('@aws-sdk/client-s3', () => ({
  PutObjectCommand: class PutObjectCommand {
    constructor(public input: unknown) {}
  },
  GetObjectCommand: class GetObjectCommand {
    constructor(public input: unknown) {}
  },
}))
vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn(async () => 'https://r2.example/signed'),
}))

import { retryOperatorJob, submitPipelineVideo } from './operator-service'

const IDEA = '22222222-2222-4222-8222-222222222222'
const CLIENT = '11111111-1111-4111-8111-111111111111'

function ideaRow(overrides: Record<string, unknown> = {}) {
  return {
    id: IDEA,
    client_id: CLIENT,
    title: 'Reel',
    hook: 'gancho',
    content_type: 'R',
    status: 'grabada',
    approval_status: 'pending',
    publish_date: null,
    published_at: null,
    generated_caption: null,
    caption_draft: null,
    theme: null,
    created_at: '2026-10-20T00:00:00Z',
    client: { id: CLIENT, name: 'Cliente' },
    videos: [{
      id: 'raw-1',
      kind: 'raw',
      status: 'uploaded',
      storage_provider: 'r2',
      name: 'crudo.mp4',
      drive_file_id: `ideas/${IDEA}/raw/1-crudo.mp4`,
      drive_view_link: null,
      mime_type: 'video/mp4',
      size_bytes: 4,
      uploaded_at: '2026-10-20T00:00:00Z',
    }],
    ...overrides,
  }
}

function fakeDb(row: Record<string, unknown> | null) {
  const updates: Array<{ table: string; patch: unknown }> = []
  const inserts: Array<{ table: string; row: unknown }> = []
  const db = {
    updates,
    inserts,
    from(table: string) {
      const api = {
        select() { return api },
        eq() { return api },
        or() { return api },
        order() { return api },
        limit() { return api },
        maybeSingle: async () => ({ data: table === 'content_ideas' ? row : null, error: null }),
        single: async () => ({ data: { id: 'video-new' }, error: null }),
        insert(value: unknown) {
          inserts.push({ table, row: value })
          return api
        },
        update(patch: unknown) {
          updates.push({ table, patch })
          return api
        },
        then(resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) {
          return Promise.resolve({ data: null, error: null, count: 0 }).then(resolve, reject)
        },
      }
      return api
    },
  }
  return db
}

beforeEach(() => {
  r2State.configured = true
})

describe('submitPipelineVideo', () => {
  it('responde 404 y no firma si la idea no existe', async () => {
    const db = fakeDb(null)
    const result = await submitPipelineVideo(db as never, {
      ideaId: IDEA,
      fileName: 'corte.mp4',
      contentType: 'video/mp4',
    })
    expect(result.status).toBe(404)
    expect(db.inserts).toHaveLength(0)
    expect(result.body).not.toHaveProperty('upload')
  })

  it('sin R2 responde 503 y no menciona Entregas', async () => {
    r2State.configured = false
    const db = fakeDb(ideaRow())
    const result = await submitPipelineVideo(db as never, {
      ideaId: IDEA,
      fileName: 'corte.mp4',
      contentType: 'video/mp4',
    })
    expect(result.status).toBe(503)
    expect(String(result.body.error)).toMatch(/R2/)
    expect(String(result.body.error)).not.toMatch(/Entregas/)
    expect(db.inserts).toHaveLength(0)
  })
})

describe('retryOperatorJob register', () => {
  it('inserta el video y no escribe status, approval ni theme en la idea', async () => {
    const db = fakeDb(ideaRow())
    const result = await retryOperatorJob(
      db as never,
      IDEA,
      {
        step: 'register',
        key: `ideas/${IDEA}/edited/10-corte.mp4`,
        name: 'corte.mp4',
        sizeBytes: 20,
        mimeType: 'video/mp4',
      },
      async () => ({ ok: true, caption: 'no' }),
    )
    expect(result.status).toBe(200)
    expect(db.updates.filter((u) => u.table === 'content_ideas')).toEqual([])
    expect(db.inserts).toEqual([{
      table: 'content_idea_videos',
      row: expect.objectContaining({
        idea_id: IDEA,
        kind: 'edited',
        name: 'corte.mp4',
        storage_provider: 'r2',
        status: 'uploaded',
      }),
    }])
    expect(db.inserts[0].row).not.toHaveProperty('approval_status')
    expect(db.inserts[0].row).not.toHaveProperty('theme')
  })
})
