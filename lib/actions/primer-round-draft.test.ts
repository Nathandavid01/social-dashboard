import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PRIMER_ROUND_CLIENT_ID } from '@/lib/primer-round/constants'
import { PRIMER_ROUND_UPLOAD_MAX_BYTES } from '@/lib/primer-round/upload-limits'

const h = vi.hoisted(() => ({
  idea: {
    id: 'idea-1',
    client_id: '7f4a8757-7811-4fb4-afc0-87dc0c50c56d',
    content_type: 'R',
    status: 'producida',
    metricool_post_id: null as number | null,
    posted_at: null as string | null,
    generated_caption: 'Caption',
    caption_draft: 'Caption',
    client: {
      id: '7f4a8757-7811-4fb4-afc0-87dc0c50c56d',
      metricool_blog_id: '5476146',
      platforms: ['instagram', 'facebook', 'tiktok'],
      default_platforms: ['instagram', 'facebook', 'tiktok'],
    },
  },
  video: {
    id: 'video-1',
    drive_file_id: 'entregas/idea-1/edited/clip.mp4',
    storage_provider: 'entregas-r2',
    name: 'clip.mp4',
  } as Record<string, unknown> | null,
  updates: [] as Record<string, unknown>[],
}))

vi.mock('@/lib/auth/server', () => ({
  requirePermission: vi.fn(async () => {}),
  currentUserHas: vi.fn(async () => true),
  getEffectiveUserId: vi.fn(async () => 'user-1'),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/utils/idea-activity', () => ({ logIdeaActivity: vi.fn(async () => {}) }))
vi.mock('@/lib/actions/idea-captions', () => ({
  generateIdeaCaption: vi.fn(async () => ({ ok: true, caption: 'Caption IA' })),
}))
vi.mock('@/lib/integrations/video-health', () => ({
  checkVideoPlayable: vi.fn(async () => ({ ok: true })),
}))
vi.mock('@/lib/integrations/entregas-r2', () => ({
  entregasR2PublicUrl: (key: string) => `https://cdn.example/${key}`,
}))
vi.mock('@/lib/integrations/r2', () => ({
  r2PublicUrl: (key: string) => `https://r2.example/${key}`,
}))

function chain(result: unknown) {
  const obj: Record<string, unknown> = {}
  obj.select = () => obj
  obj.insert = () => obj
  obj.update = (row: Record<string, unknown>) => {
    h.updates.push(row)
    return obj
  }
  obj.eq = () => obj
  obj.in = () => obj
  obj.not = () => obj
  obj.order = () => obj
  obj.maybeSingle = async () => ({ data: result, error: null })
  obj.single = async () => ({ data: result, error: null })
  return obj
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) },
    from: (table: string) => {
      if (table === 'content_ideas') {
        const obj = chain(h.idea)
        obj.update = (row: Record<string, unknown>) => {
          h.updates.push(row)
          return chain(h.idea)
        }
        obj.insert = (row: Record<string, unknown>) => {
          const next = chain({ id: 'new-idea', title: row.title })
          return next
        }
        return obj
      }
      if (table === 'content_idea_videos') return chain(h.video)
      if (table === 'content_idea_video_analysis') {
        return chain({ findings: null, visual_summary: 'estudio', status: 'done' })
      }
      return chain(null)
    },
  }),
}))

import { createPrimerRoundUploadIdea, pushPrimerRoundDraft } from './primer-round'

function captureFetch() {
  const spy = vi.fn(async () => ({
    ok: true,
    json: async () => ({ data: { id: 77, uuid: 'u-77' } }),
  }))
  vi.stubGlobal('fetch', spy)
  return spy
}

const bodyOf = (spy: ReturnType<typeof vi.fn>) =>
  JSON.parse((spy.mock.calls[0][1] as { body: string }).body)

afterEach(() => {
  vi.unstubAllGlobals()
})

beforeEach(() => {
  h.idea.metricool_post_id = null
  h.idea.posted_at = null
  h.idea.client_id = PRIMER_ROUND_CLIENT_ID
  h.idea.client.id = PRIMER_ROUND_CLIENT_ID
  h.video = {
    id: 'video-1',
    drive_file_id: 'entregas/idea-1/edited/clip.mp4',
    storage_provider: 'entregas-r2',
    name: 'clip.mp4',
  }
  h.updates = []
  process.env.METRICOOL_TOKEN = 'tok'
  process.env.METRICOOL_USER_ID = 'uid'
  process.env.METRICOOL_BLOG_ID = 'blog'
})

describe('createPrimerRoundUploadIdea', () => {
  it('rechaza un archivo de más de 500 MB', async () => {
    const res = await createPrimerRoundUploadIdea({
      fileName: 'huge.mov',
      sizeBytes: PRIMER_ROUND_UPLOAD_MAX_BYTES + 1,
    })
    expect(res.ideaId).toBeUndefined()
    expect(res.error).toMatch(/500 MB/i)
  })
})

describe('pushPrimerRoundDraft', () => {
  it('manda un borrador (draft:true) con collabs rafaellenin + denniseyperez y nunca autoPublish', async () => {
    const spy = captureFetch()
    const res = await pushPrimerRoundDraft({
      ideaId: 'idea-1',
      videoId: 'video-1',
      caption:
        'Hoy en Primer Round junto a Rafael Lenín López y Dennise Pérez.\n\n#magic973 #puertorico #primerround',
      pieceKind: 'live',
    })
    expect(res.ok).toBe(true)
    expect(res.metricoolPostId).toBe(77)
    const body = bodyOf(spy)
    expect(body.draft).toBe(true)
    expect(body.autoPublish).toBeUndefined()
    expect(body.instagramData.collaborators).toEqual(
      expect.arrayContaining([
        { username: 'rafaellenin', deleted: false },
        { username: 'denniseyperez', deleted: false },
      ]),
    )
    expect(h.updates.some((u) => u.metricool_post_id === 77)).toBe(true)
    expect(h.updates.some((u) => u.published_at)).toBe(false)
    expect(h.updates.some((u) => u.approval_status === 'approved')).toBe(false)
  })

  it('no reenvía si ya hay post en Metricool', async () => {
    h.idea.metricool_post_id = 9
    const spy = captureFetch()
    const res = await pushPrimerRoundDraft({
      ideaId: 'idea-1',
      videoId: 'video-1',
      caption: 'Caption',
    })
    expect(res.ok).toBeUndefined()
    expect(res.error).toMatch(/Ya hay un post/i)
    expect(spy).not.toHaveBeenCalled()
  })
})
