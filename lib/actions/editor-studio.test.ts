import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PRIMER_ROUND_CLIENT_ID } from '@/lib/primer-round/constants'

const h = vi.hoisted(() => ({
  role: 'editor' as string,
  has: true,
  idea: {} as Record<string, unknown>,
  video: {
    id: 'vid-1',
    drive_file_id: 'entregas/idea/edited/1.mp4',
    storage_provider: 'entregas-r2',
    kind: 'edited',
    status: 'uploaded',
  } as Record<string, unknown> | null,
  clients: [
    {
      id: '7f4a8757-7811-4fb4-afc0-87dc0c50c56d',
      name: 'Primer Round Oficial',
      logo_url: null,
      metricool_blog_id: '5476146',
      platforms: ['instagram', 'facebook', 'tiktok'],
      default_platforms: null,
      status: 'active',
    },
  ],
  writes: [] as Record<string, unknown>[],
  post: vi.fn(),
  health: vi.fn(),
  caption: vi.fn(),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth/server', () => ({
  requirePermission: vi.fn(async () => {
    if (!h.has) throw new Error('Acceso denegado (falta permiso: metricool.draft)')
  }),
  currentUserHas: vi.fn(async () => h.has),
  getEffectiveRole: vi.fn(async () => h.role),
  getEffectiveUserId: vi.fn(async () => 'editor-1'),
}))
vi.mock('@/lib/actions/idea-captions', () => ({
  generateIdeaCaption: (...args: unknown[]) => h.caption(...args),
}))
vi.mock('@/lib/actions/recording-editors', () => ({
  getMyEditorClients: vi.fn(async () => ({
    clients: h.clients.map((c) => ({ id: c.id, name: c.name })),
  })),
}))
vi.mock('@/lib/metricool/post', () => ({ createDraftPost: (...args: unknown[]) => h.post(...args) }))
vi.mock('@/lib/integrations/video-health', () => ({
  checkVideoPlayable: (...args: unknown[]) => h.health(...args),
}))
vi.mock('@/lib/integrations/r2', () => ({ r2PublicUrl: () => 'https://pipeline.example/edited.mp4' }))
vi.mock('@/lib/integrations/entregas-r2', () => ({
  entregasR2PublicUrl: () => 'https://entregas.example/edited.mp4',
}))
vi.mock('@/lib/utils/idea-activity', () => ({ logIdeaActivity: vi.fn(async () => {}) }))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'editor-1' } } }) },
    from(table: string) {
      let write = false
      const q: Record<string, unknown> = {
        select: () => q,
        insert: (payload: Record<string, unknown>) => {
          h.writes.push(payload)
          return q
        },
        update: (payload: Record<string, unknown>) => {
          write = true
          h.writes.push(payload)
          return q
        },
        eq: () => q,
        in: () => q,
        not: () => q,
        is: () => q,
        order: () => q,
        maybeSingle: async () => {
          if (table === 'content_idea_videos') return { data: h.video, error: null }
          if (table === 'content_idea_video_analysis') {
            return { data: { visual_summary: 'Estudio de radio' }, error: null }
          }
          return { data: h.idea, error: null }
        },
        single: async () => {
          if (table === 'content_ideas' && h.writes.some((w) => w.client_id)) {
            return { data: { id: 'new-idea', title: h.writes.at(-1)?.title }, error: null }
          }
          return { data: h.idea, error: null }
        },
        then: (resolve: (v: unknown) => unknown) =>
          resolve({
            data:
              table === 'clients'
                ? h.clients
                : write
                  ? [{ id: 'idea' }]
                  : table === 'content_idea_videos'
                    ? h.video
                      ? [h.video]
                      : []
                    : [],
            error: null,
          }),
      }
      return q
    },
  }),
}))

import {
  createEditorStudioIdea,
  generateEditorStudioCaption,
  getEditorStudio,
  pushEditorStudioDraft,
} from './editor-studio'

beforeEach(() => {
  h.role = 'editor'
  h.has = true
  h.writes = []
  h.video = {
    id: 'vid-1',
    drive_file_id: 'entregas/idea/edited/1.mp4',
    storage_provider: 'entregas-r2',
    kind: 'edited',
    status: 'uploaded',
  }
  h.idea = {
    id: 'idea',
    client_id: PRIMER_ROUND_CLIENT_ID,
    status: 'producida',
    published_at: null,
    metricool_post_id: null,
    posted_at: null,
    generated_caption: null,
    caption_draft: 'Hoy en Primer Round junto a Rafael Lenín López y Dennise Pérez.',
    content_type: 'R',
    client: {
      id: PRIMER_ROUND_CLIENT_ID,
      metricool_blog_id: '5476146',
      platforms: ['instagram', 'facebook', 'tiktok'],
    },
  }
  h.post.mockReset().mockResolvedValue({ data: { id: 88, uuid: 'draft-u' } })
  h.health.mockReset().mockResolvedValue({ ok: true })
  h.caption.mockReset().mockResolvedValue({ ok: true, caption: 'Caption IA' })
})

describe('getEditorStudio', () => {
  it('returns clients and Primer Round collabs for an editor', async () => {
    const res = await getEditorStudio()
    expect(res.error).toBeUndefined()
    expect(res.studio?.clients.some((c) => c.isPrimerRound)).toBe(true)
    expect(res.studio?.primerRoundCollabs.map((c) => c.username).sort()).toEqual([
      'denniseyperez',
      'rafaellenin',
    ])
    expect(res.studio?.maxUploadBytes).toBe(500 * 1024 * 1024)
  })

  it('denies roles without metricool.draft', async () => {
    h.has = false
    const res = await getEditorStudio()
    expect(res.error).toMatch(/denegado/)
  })
})

describe('createEditorStudioIdea', () => {
  it('creates a pending Reel for the chosen client', async () => {
    const res = await createEditorStudioIdea({
      clientId: PRIMER_ROUND_CLIENT_ID,
      fileName: 'clip-vivo.mp4',
    })
    expect(res.ideaId).toBe('new-idea')
    expect(h.writes[0]).toMatchObject({
      client_id: PRIMER_ROUND_CLIENT_ID,
      content_type: 'R',
      status: 'producida',
      approval_status: 'pending',
    })
  })
})

describe('generateEditorStudioCaption', () => {
  it('pins the uploaded video and passes LIVE piece kind', async () => {
    const res = await generateEditorStudioCaption({
      ideaId: 'idea',
      videoId: 'vid-1',
      pieceKind: 'live',
    })
    expect(res.caption).toBe('Caption IA')
    expect(h.caption).toHaveBeenCalledWith(
      'idea',
      expect.objectContaining({ videoId: 'vid-1', pieceKind: 'live' }),
    )
  })
})

describe('pushEditorStudioDraft', () => {
  it('creates a Metricool DRAFT with Primer Round collabs — never auto-publishes', async () => {
    const res = await pushEditorStudioDraft({
      ideaId: 'idea',
      videoId: 'vid-1',
      caption: 'Hoy en Primer Round junto a Rafael Lenín López y Dennise Pérez.',
    })
    expect(res).toMatchObject({ ok: true, metricoolPostId: 88 })
    expect(h.post).toHaveBeenCalledTimes(1)
    const args = h.post.mock.calls[0]
    expect(args[5]).toEqual(
      expect.objectContaining({
        autoPublish: false,
        mediaUrls: ['https://entregas.example/edited.mp4'],
        instagramCollaborators: expect.arrayContaining([
          expect.objectContaining({ username: 'rafaellenin' }),
          expect.objectContaining({ username: 'denniseyperez' }),
        ]),
      }),
    )
  })

  it('does not require approval_status=approved', async () => {
    h.idea.approval_status = 'pending'
    const res = await pushEditorStudioDraft({ ideaId: 'idea', videoId: 'vid-1' })
    expect(res.ok).toBe(true)
    expect(h.post).toHaveBeenCalled()
  })

  it('skips collabs when the editor turns them off', async () => {
    await pushEditorStudioDraft({
      ideaId: 'idea',
      videoId: 'vid-1',
      includeCollabs: false,
    })
    expect(h.post.mock.calls[0][5].instagramCollaborators).toBeUndefined()
  })
})
