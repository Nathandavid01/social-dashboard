/**
 * Generar un caption NO puede mover el video de etapa.
 *
 * `ideaStage()` (lib/entregas/batches.ts) manda a Publicación todo video
 * aprobado cuyo `generated_caption` no esté vacío. Mientras `generateIdeaCaption`
 * escribiera ese campo, apretar "Generar con IA" sacaba el video de Copy sin que
 * nadie lo leyera, editara ni aprobara — el bug que estos tests fijan.
 *
 * El borrador vive en `caption_draft`; sólo guardar lo promueve.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({
  updates: [] as Record<string, unknown>[],
  idea: {
    id: 'i1',
    client_id: 'c1',
    title: 'Video de prueba',
    hook: 'Un socio bajó 15 lb',
    visual_brief: 'Habla a cámara en el gym',
    caption_angle: null,
    hashtags_suggestion: null,
    content_type: 'R',
    client: { name: 'Gym X', platforms: ['instagram'], default_platforms: ['instagram'] },
  } as Record<string, unknown>,
  videos: [
    {
      id: 'v1',
      kind: 'raw',
      status: 'uploaded',
      drive_file_id: 'ideas/1/raw/a.mp4',
      storage_provider: 'r2',
    },
  ],
}))

vi.mock('@/lib/auth/server', () => ({ requirePermission: vi.fn(async () => {}) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/utils/idea-activity', () => ({ logIdeaActivity: vi.fn(async () => {}) }))
vi.mock('@/lib/integrations/metricool-style', () => ({
  fetchClientStyleExamples: vi.fn(async () => [] as string[]),
}))
vi.mock('@/lib/integrations/caption-learning', () => ({
  fetchApprovedCaptionExamples: vi.fn(async () => [] as string[]),
  fetchCaptionFeedbackForPrompt: vi.fn(async () => ({ loved: [], avoid: [] })),
}))
vi.mock('@/lib/llm/caption-llm', () => ({
  captionConfigError: () => null,
  generateCaptionText: vi.fn(async () => 'Caption recién salido de la IA'),
}))
vi.mock('@/lib/integrations/whisper', () => ({
  transcribeVideoFromUrl: vi.fn(async () => 'el socio cuenta que bajó 15 libras'),
}))
vi.mock('@/lib/integrations/caption-listen-url', () => ({
  listenUrlForCaptionVideo: vi.fn(async () => 'https://pipe.test/ideas/1/raw/a.mp4'),
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: (table: string) => {
      if (table === 'content_idea_videos') {
        return {
          select: () => ({
            eq: () => ({
              neq: () => ({
                limit: async () => ({ data: h.videos, error: null }),
                then: (resolve: (v: unknown) => unknown) =>
                  resolve({ data: h.videos, error: null }),
              }),
            }),
          }),
        }
      }
      return {
        select: () => ({ eq: () => ({ single: async () => ({ data: h.idea, error: null }) }) }),
        update: (payload: Record<string, unknown>) => {
          h.updates.push(payload)
          return { eq: async () => ({ error: null }) }
        },
      }
    },
  }),
}))

import { generateCaptionText } from '@/lib/llm/caption-llm'
import { transcribeVideoFromUrl } from '@/lib/integrations/whisper'
import { listenUrlForCaptionVideo } from '@/lib/integrations/caption-listen-url'
import { generateIdeaCaption, saveIdeaCaption } from './idea-captions'

beforeEach(() => {
  h.updates.length = 0
  vi.mocked(listenUrlForCaptionVideo).mockResolvedValue('https://pipe.test/ideas/1/raw/a.mp4')
  vi.mocked(transcribeVideoFromUrl).mockResolvedValue('el socio cuenta que bajó 15 libras')
  h.videos = [
    {
      id: 'v1',
      kind: 'raw',
      status: 'uploaded',
      drive_file_id: 'ideas/1/raw/a.mp4',
      storage_provider: 'r2',
    },
  ]
})

describe('generateIdeaCaption — sin video no hay caption', () => {
  it('se niega si la idea no tiene video', async () => {
    h.videos = []
    const res = await generateIdeaCaption('i1')
    expect(res.error).toMatch(/video/i)
    expect(h.updates).toHaveLength(0)
  })
})

describe('generateIdeaCaption — genera un BORRADOR, no publica', () => {
  it('pasa al modelo lo que se oyó en el video', async () => {
    await generateIdeaCaption('i1')
    expect(listenUrlForCaptionVideo).toHaveBeenCalled()
    expect(generateCaptionText).toHaveBeenCalledWith(
      expect.stringContaining('el socio cuenta que bajó 15 libras'),
    )
  })

  it('sigue generando desde el hook si no se pudo oír el video', async () => {
    vi.mocked(listenUrlForCaptionVideo).mockResolvedValueOnce(null)
    vi.mocked(transcribeVideoFromUrl).mockClear()
    await generateIdeaCaption('i1')
    expect(transcribeVideoFromUrl).not.toHaveBeenCalled()
    expect(h.updates[0].caption_draft).toBe('Caption recién salido de la IA')
  })

  it('escribe el texto en caption_draft', async () => {
    const res = await generateIdeaCaption('i1')
    expect(res.caption).toBe('Caption recién salido de la IA')
    expect(h.updates).toHaveLength(1)
    expect(h.updates[0].caption_draft).toBe('Caption recién salido de la IA')
  })

  it('NUNCA toca generated_caption — es lo que movería el video a Publicación', async () => {
    await generateIdeaCaption('i1')
    for (const u of h.updates) {
      expect(u).not.toHaveProperty('generated_caption')
    }
  })

  it('tampoco marca caption_generated_at (ese sello es del caption aprobado)', async () => {
    await generateIdeaCaption('i1')
    for (const u of h.updates) {
      expect(u).not.toHaveProperty('caption_generated_at')
    }
  })

  it('regenerar con feedback sigue siendo sólo borrador', async () => {
    await generateIdeaCaption('i1', { feedback: 'más corto', previousCaption: 'viejo' })
    expect(h.updates[0].caption_draft).toBe('Caption recién salido de la IA')
    expect(h.updates[0]).not.toHaveProperty('generated_caption')
  })
})

describe('saveIdeaCaption — guardar es lo que promueve el borrador', () => {
  it('escribe generated_caption con el texto que el humano guardó', async () => {
    await saveIdeaCaption('i1', 'Caption revisado por el equipo')
    expect(h.updates).toHaveLength(1)
    expect(h.updates[0].generated_caption).toBe('Caption revisado por el equipo')
    expect(h.updates[0].caption_generated_at).toEqual(expect.any(String))
  })

  it('limpia el borrador al promoverlo — no puede quedar un fantasma', async () => {
    await saveIdeaCaption('i1', 'Caption revisado por el equipo')
    expect(h.updates[0].caption_draft).toBeNull()
  })

  it('rechaza guardar un caption vacío — vaciarlo devolvería el video a Copy sin querer', async () => {
    const res = await saveIdeaCaption('i1', '   ')
    expect(res.error).toBeTruthy()
    expect(h.updates).toHaveLength(0)
  })
})
