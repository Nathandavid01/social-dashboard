import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  perm: 'posting.publish' as string | null,
  idea: {} as Record<string, unknown>,
  videos: [] as Record<string, unknown>[],
  writes: [] as Record<string, unknown>[],
  filters: [] as Array<[string, unknown]>,
  claimed: [{ id: 'idea' }] as Array<{ id: string }>,
  recordFail: false,
  post: vi.fn(),
  health: vi.fn(),
}))

vi.mock('@/lib/auth/server', () => ({
  requirePermission: vi.fn(async (perm: string) => {
    if (h.perm && h.perm !== perm) throw new Error('No autorizado')
  }),
  currentUserHas: vi.fn(async () => true),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/metricool/post', () => ({ createDraftPost: h.post }))
vi.mock('@/lib/integrations/video-health', () => ({ checkVideoPlayable: h.health }))
vi.mock('@/lib/integrations/r2', () => ({ r2PublicUrl: () => 'https://pipeline.example/edited.mp4' }))
vi.mock('@/lib/integrations/entregas-r2', () => ({
  entregasR2PublicUrl: () => 'https://entregas.example/edited.mp4',
}))
vi.mock('@/lib/utils/idea-activity', () => ({ logIdeaActivity: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'owner' } } }) },
    from(table: string) {
      let write = false
      const q: Record<string, unknown> = {
        select: () => q,
        order: () => q,
        limit: () => q,
        eq: (col: string, val: unknown) => {
          h.filters.push([col, val])
          return q
        },
        is: (col: string, val: unknown) => {
          h.filters.push([col, val])
          return q
        },
        in: () => q,
        neq: () => q,
        update: (payload: Record<string, unknown>) => {
          write = true
          h.writes.push(payload)
          return q
        },
        single: async () => ({
          data: table === 'content_ideas' ? h.idea : null,
          error: null,
        }),
        then: (resolve: (v: unknown) => unknown) => {
          if (write && h.recordFail && h.writes.at(-1)?.metricool_post_id != null) {
            return resolve({ data: [], error: { message: 'bookkeeping down' } })
          }
          return resolve({
            data: write
              ? h.claimed
              : table === 'content_idea_videos'
                ? h.videos
                : [],
            error: null,
          })
        },
      }
      return q
    },
  })),
}))

import { schedulePoolIdea } from './client-pool'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-20T14:00:00Z'))
  h.perm = 'posting.publish'
  h.writes = []
  h.filters = []
  h.claimed = [{ id: 'idea' }]
  h.recordFail = false
  h.post.mockReset().mockResolvedValue({ data: { id: 44, uuid: 'u-44' } })
  h.health.mockReset().mockResolvedValue({ ok: true })
  h.videos = [{
    id: 'vid',
    idea_id: 'idea',
    kind: 'edited',
    status: 'uploaded',
    storage_provider: 'entregas-r2',
    drive_file_id: 'edited.mp4',
    uploaded_at: '2026-09-19T12:00:00Z',
  }]
  h.idea = {
    id: 'idea',
    title: 'Hook del reel',
    hook: 'hook',
    content_type: 'R',
    status: 'producida',
    generated_caption: 'Caption listo',
    publish_date: null,
    published_at: null,
    manual_posted_status: null,
    metricool_post_id: null,
    posted_at: null,
    staff_client_approval: 'approved',
    client_review_status: null,
    client_id: 'ai-client',
    client: {
      id: 'ai-client',
      edit_mode: 'ai',
      metricool_blog_id: 'blog-ai',
      platforms: ['instagram'],
      default_platforms: ['instagram'],
      posting_time: '09:15',
      posting_schedule: null,
    },
  }
})

describe('schedulePoolIdea', () => {
  it('exige posting.publish', async () => {
    h.perm = 'other'
    expect(await schedulePoolIdea({ ideaId: 'idea', date: '2026-09-23' })).toEqual({
      error: 'No autorizado',
    })
    expect(h.post).not.toHaveBeenCalled()
  })

  it('no agenda un cliente humano de Entregas (no salta Revisión)', async () => {
    ;(h.idea.client as { edit_mode: string }).edit_mode = 'human'
    expect(await schedulePoolIdea({ ideaId: 'idea', date: '2026-09-23' })).toMatchObject({
      error: expect.stringMatching(/Recibo|pool|AI/i),
    })
    expect(h.post).not.toHaveBeenCalled()
  })

  it('no agenda un video que sigue en recibo', async () => {
    h.idea.staff_client_approval = null
    expect(await schedulePoolIdea({ ideaId: 'idea', date: '2026-09-23' })).toMatchObject({
      error: expect.stringMatching(/Listo|aprobado|recibo/i),
    })
    expect(h.post).not.toHaveBeenCalled()
  })

  it('Listo → Agendado: Metricool con el blog_id del cliente y persiste el id', async () => {
    const res = await schedulePoolIdea({ ideaId: 'idea', date: '2026-09-23' })
    expect(res).toMatchObject({ ok: true, state: 'agendado' })
    expect(h.post).toHaveBeenCalledWith(
      'Caption listo',
      'blog-ai',
      ['instagram'],
      undefined,
      '2026-09-23T09:15:00',
      expect.objectContaining({
        autoPublish: true,
        mediaUrls: ['https://entregas.example/edited.mp4'],
      }),
    )
    expect(h.writes.some((w) => w.metricool_post_id === 44 && w.publish_date === '2026-09-23')).toBe(true)
  })

  it('usa el caption si existe; si no, el título (una redada, todas las redes)', async () => {
    h.idea.generated_caption = '   '
    await schedulePoolIdea({ ideaId: 'idea', date: '2026-09-24' })
    expect(h.post.mock.calls[0][0]).toBe('Hook del reel')
  })

  it('Agendado se reprograma sin un segundo POST a Metricool', async () => {
    h.idea.metricool_post_id = 44
    h.idea.posted_at = '2026-09-20T10:00:00Z'
    const res = await schedulePoolIdea({ ideaId: 'idea', date: '2026-09-25' })
    expect(res).toMatchObject({ ok: true, state: 'agendado', rescheduled: true })
    expect(h.post).not.toHaveBeenCalled()
    expect(h.writes).toEqual([expect.objectContaining({ publish_date: '2026-09-25' })])
    expect(h.writes[0]).not.toHaveProperty('metricool_post_id')
  })

  it('no crea otro post si el claim ya está tomado', async () => {
    h.claimed = []
    expect(await schedulePoolIdea({ ideaId: 'idea', date: '2026-09-23' })).toMatchObject({
      error: expect.stringMatching(/agendado|envío/i),
    })
    expect(h.post).not.toHaveBeenCalled()
  })

  it('si Metricool crea el post y falla el save, no suelta el claim', async () => {
    h.recordFail = true
    const res = await schedulePoolIdea({ ideaId: 'idea', date: '2026-09-23' })
    expect(res.error).toMatch(/no se pudo guardar/i)
    expect(h.post).toHaveBeenCalledTimes(1)
    expect(h.writes.some((w) => w.posting_started_at === null && w.metricool_post_id == null)).toBe(false)
  })

  it('no crea otro post si ya está publicado', async () => {
    h.idea.status = 'publicada'
    expect(await schedulePoolIdea({ ideaId: 'idea', date: '2026-09-23' })).toMatchObject({
      error: expect.stringMatching(/publicado/i),
    })
    expect(h.post).not.toHaveBeenCalled()
  })
})
