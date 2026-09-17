import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EDITOR_UPLOAD_MAX_BYTES } from '@/lib/editor-upload/limits'

const PR_ID = '7f4a8757-7811-4fb4-afc0-87dc0c50c56d'

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
  clientRow: { id: '7f4a8757-7811-4fb4-afc0-87dc0c50c56d', status: 'active' },
  updates: [] as Record<string, unknown>[],
  inserts: [] as Record<string, unknown>[],
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
vi.mock('@/lib/actions/recording-editors', () => ({
  getMyEditorClients: vi.fn(async () => ({ clients: [{ id: '7f4a8757-7811-4fb4-afc0-87dc0c50c56d', name: 'PR' }] })),
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
  obj.insert = (row: Record<string, unknown>) => {
    h.inserts.push(row)
    return obj
  }
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
          const next = chain(h.idea)
          return next
        }
        return obj
      }
      if (table === 'content_idea_videos') return chain(h.video)
      if (table === 'content_idea_video_analysis') {
        return chain({ findings: null, visual_summary: 'estudio', status: 'done' })
      }
      if (table === 'clients') return chain(h.clientRow)
      return chain(null)
    },
  }),
}))

import { createEditorUploadIdea, pushEditorUploadDraft } from './editor-upload'

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
  h.idea.client_id = PR_ID
  h.idea.client.id = PR_ID
  h.clientRow.id = PR_ID
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

describe('createEditorUploadIdea', () => {
  it('rechaza un archivo de más de 500 MB', async () => {
    const res = await createEditorUploadIdea({
      clientId: PR_ID,
      fileName: 'huge.mov',
      sizeBytes: EDITOR_UPLOAD_MAX_BYTES + 1,
    })
    expect(res.ideaId).toBeUndefined()
    expect(res.error).toMatch(/500 MB/i)
  })
})

describe('pushEditorUploadDraft', () => {
  it('manda un borrador (draft:true) y nunca autoPublish', async () => {
    const spy = captureFetch()
    const res = await pushEditorUploadDraft({
      ideaId: 'idea-1',
      videoId: 'video-1',
      caption: 'Hoy en Primer Round junto a Rafael Lenín López y Dennise Pérez.\n\n#magic973 #puertorico #primerround',
      includeCollabs: true,
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

  it('sin collabs no taguea hosts', async () => {
    h.idea.client_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
    h.idea.client.id = h.idea.client_id
    h.clientRow.id = h.idea.client_id
    const spy = captureFetch()
    const res = await pushEditorUploadDraft({
      ideaId: 'idea-1',
      videoId: 'video-1',
      caption: 'Un caption cualquiera #tag',
      includeCollabs: false,
    })
    expect(res.ok).toBe(true)
    const body = bodyOf(spy)
    expect(body.draft).toBe(true)
    expect(body.instagramData?.collaborators).toBeUndefined()
  })

  it('no reenvía si ya hay post en Metricool', async () => {
    h.idea.metricool_post_id = 9
    const spy = captureFetch()
    const res = await pushEditorUploadDraft({
      ideaId: 'idea-1',
      videoId: 'video-1',
      caption: 'Caption',
      includeCollabs: false,
    })
    expect(res.ok).toBeUndefined()
    expect(res.error).toMatch(/Ya hay un post/i)
    expect(spy).not.toHaveBeenCalled()
  })
})
