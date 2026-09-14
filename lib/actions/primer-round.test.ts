import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PRIMER_ROUND_CLIENT_ID } from '@/lib/primer-round/constants'
import { PRIMER_ROUND_PIN_GONE, PRIMER_ROUND_PIN_MISSING } from '@/lib/primer-round/pinned-video'

const leftoverVideo = '77f8ae28-2b1a-4ee2-80a8-6d4ff144cf36'
const leftoverIdea = '12f46972-9356-40b0-8ace-871728801a06'

const h = vi.hoisted(() => ({
  idea: {
    id: 'new-idea',
    client_id: '7f4a8757-7811-4fb4-afc0-87dc0c50c56d',
    generated_caption: 'Caption nuevo',
    caption_draft: 'Caption nuevo',
    approval_status: 'pending',
  } as Record<string, unknown>,
  video: { id: 'new-video' } as { id: string } | null,
  runIdeaPostCalls: [] as Array<{ ideaId: string; opts?: { videoFileId?: string | null } }>,
}))

vi.mock('@/lib/auth/server', () => ({
  currentUserHas: vi.fn(async () => true),
  requirePermission: vi.fn(async () => {}),
  getEffectiveUserId: vi.fn(async () => 'user-1'),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/utils/idea-activity', () => ({ logIdeaActivity: vi.fn(async () => {}) }))
vi.mock('@/lib/llm/caption-llm', () => ({
  captionConfigError: () => null,
  generateCaptionText: vi.fn(async () => '{"overlay_ok":true,"caption_ok":true,"issues":[]}'),
}))
vi.mock('@/lib/actions/idea-captions', () => ({
  generateIdeaCaption: vi.fn(async () => ({ ok: true, caption: 'Caption nuevo' })),
}))
vi.mock('@/lib/actions/idea-posting-run', () => ({
  runIdeaPost: vi.fn(async (_db: unknown, ideaId: string, _user: string, _when: string | null, opts?: { videoFileId?: string | null }) => {
    h.runIdeaPostCalls.push({ ideaId, opts })
    return { ok: true, metricoolPostId: 9 }
  }),
}))
vi.mock('@/lib/primer-round/collabs', () => ({
  resolvePrimerRoundCollaborators: () => [
    { username: 'denniseyperez', label: 'Dennise Pérez' },
    { username: 'rafaellenin', label: 'Rafael Lenín López' },
  ],
  primerRoundCollabLabels: () => [],
}))
vi.mock('@/lib/primer-round/style-rules', () => ({
  loadPrimerRoundStyleRules: vi.fn(async () => []),
}))

function videoChain() {
  const filters: Record<string, string> = {}
  const obj: Record<string, unknown> = {}
  obj.select = () => obj
  obj.eq = (key: string, value: string) => {
    filters[key] = value
    return obj
  }
  obj.not = () => obj
  obj.order = () => obj
  obj.limit = () => obj
  obj.maybeSingle = async () => {
    if (!h.video) return { data: null, error: null }
    if (filters.id && filters.id !== h.video.id) return { data: null, error: null }
    if (filters.idea_id && filters.idea_id !== h.idea.id) return { data: null, error: null }
    return { data: h.video, error: null }
  }
  return obj
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) },
    from: (table: string) => {
      if (table === 'content_idea_videos') return videoChain()
      if (table === 'content_idea_video_analysis') {
        const obj: Record<string, unknown> = {}
        obj.select = () => obj
        obj.eq = () => obj
        obj.maybeSingle = async () => ({
          data: { findings: { burned_captions: { text: 'LA NOTICIA NUEVA', issues: [] } }, status: 'done' },
          error: null,
        })
        return obj
      }
      if (table === 'content_idea_activity') {
        return { insert: async () => ({ error: null }) }
      }
      return {
        select: () => {
          const obj: Record<string, unknown> = {}
          obj.eq = () => obj
          obj.maybeSingle = async () => ({ data: h.idea, error: null })
          obj.single = async () => ({ data: h.idea, error: null })
          return obj
        },
        update: () => ({
          eq: () => ({
            eq: async () => ({ error: null }),
            then: (resolve: (v: unknown) => unknown) => resolve({ error: null }),
          }),
        }),
        insert: () => ({
          select: () => ({
            single: async () => ({ data: { id: 'new-idea', title: 'x' }, error: null }),
          }),
        }),
      }
    },
  }),
}))

import { generateIdeaCaption } from '@/lib/actions/idea-captions'
import { runIdeaPost } from '@/lib/actions/idea-posting-run'
import {
  acceptPrimerRoundPiece,
  generatePrimerRoundCaption,
  runPrimerRoundUploadPipeline,
  schedulePrimerRoundReel,
  verifyPrimerRoundOrtho,
} from './primer-round'

beforeEach(() => {
  h.idea = {
    id: 'new-idea',
    client_id: PRIMER_ROUND_CLIENT_ID,
    generated_caption: 'Caption nuevo',
    caption_draft: 'Caption nuevo',
    approval_status: 'pending',
  }
  h.video = { id: 'new-video' }
  h.runIdeaPostCalls = []
  vi.mocked(generateIdeaCaption).mockClear()
  vi.mocked(generateIdeaCaption).mockResolvedValue({ ok: true, caption: 'Caption nuevo' })
  vi.mocked(runIdeaPost).mockClear()
})

describe('Primer Round pin — no se trabaja el leftover', () => {
  it('caption, pipeline y verify se niegan sin videoId', async () => {
    await expect(generatePrimerRoundCaption('new-idea')).resolves.toMatchObject({
      error: PRIMER_ROUND_PIN_MISSING,
    })
    await expect(runPrimerRoundUploadPipeline({ ideaId: 'new-idea' })).resolves.toMatchObject({
      error: PRIMER_ROUND_PIN_MISSING,
    })
    await expect(verifyPrimerRoundOrtho('new-idea')).resolves.toMatchObject({
      error: PRIMER_ROUND_PIN_MISSING,
    })
    expect(generateIdeaCaption).not.toHaveBeenCalled()
  })

  it('caption y accept se niegan si piden el leftover de otra idea', async () => {
    const caption = await generatePrimerRoundCaption(leftoverIdea, { videoId: leftoverVideo })
    expect(caption.error).toBe(PRIMER_ROUND_PIN_GONE)
    expect(generateIdeaCaption).not.toHaveBeenCalled()

    const accept = await acceptPrimerRoundPiece({ ideaId: leftoverIdea, videoId: leftoverVideo })
    expect(accept.error).toBe(PRIMER_ROUND_PIN_GONE)
    expect(runIdeaPost).not.toHaveBeenCalled()
  })

  it('pipeline clava el video nuevo y no el leftover', async () => {
    const res = await runPrimerRoundUploadPipeline({ ideaId: 'new-idea', videoId: leftoverVideo })
    expect(res.error).toBe(PRIMER_ROUND_PIN_GONE)
    expect(generateIdeaCaption).not.toHaveBeenCalled()

    const ok = await runPrimerRoundUploadPipeline({ ideaId: 'new-idea', videoId: 'new-video' })
    expect(ok.error).toBeUndefined()
    expect(generateIdeaCaption).toHaveBeenCalledWith(
      'new-idea',
      expect.objectContaining({ videoId: 'new-video' }),
    )
    expect(generateIdeaCaption).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ videoId: leftoverVideo }),
    )
  })

  it('accept sin videoId no cae al último edited ni publica leftover', async () => {
    const missing = await acceptPrimerRoundPiece({ ideaId: 'new-idea' })
    expect(missing.error).toBe(PRIMER_ROUND_PIN_MISSING)
    const leftover = await acceptPrimerRoundPiece({ ideaId: 'new-idea', videoId: leftoverVideo })
    expect(leftover.error).toBe(PRIMER_ROUND_PIN_GONE)
    expect(runIdeaPost).not.toHaveBeenCalled()
  })

  it('schedule pasa el videoFileId clavado a runIdeaPost', async () => {
    h.idea.approval_status = 'approved'
    const res = await schedulePrimerRoundReel({
      ideaId: 'new-idea',
      videoId: 'new-video',
      overrideOrtho: true,
      scheduleOverride: '2026-09-14T16:06',
    })
    expect(res.ok).toBe(true)
    expect(h.runIdeaPostCalls[0]).toMatchObject({
      ideaId: 'new-idea',
      opts: expect.objectContaining({ videoFileId: 'new-video' }),
    })
  })
})
