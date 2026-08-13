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
import { fetchCaptionFeedbackForPrompt } from '@/lib/integrations/caption-learning'
import { packCaptionDrafts } from '@/lib/utils/caption-draft'
import { generateIdeaCaption, saveIdeaCaption } from './idea-captions'

const oneDraft = 'Caption recién salido de la IA'

beforeEach(() => {
  h.updates.length = 0
  h.idea = { ...h.idea, caption_draft: null, generated_caption: null }
  vi.mocked(generateCaptionText).mockReset()
  vi.mocked(generateCaptionText).mockResolvedValue('Caption recién salido de la IA')
  vi.mocked(fetchCaptionFeedbackForPrompt).mockReset()
  vi.mocked(fetchCaptionFeedbackForPrompt).mockResolvedValue({ loved: [], avoid: [] })
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
    expect(h.updates[0].caption_draft).toBe(oneDraft)
  })

  it('escribe el texto en caption_draft', async () => {
    const res = await generateIdeaCaption('i1')
    expect(res.caption).toBe('Caption recién salido de la IA')
    expect(h.updates).toHaveLength(1)
    expect(h.updates[0].caption_draft).toBe(oneDraft)
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
    expect(h.updates[0].caption_draft).toBe(oneDraft)
    expect(h.updates[0]).not.toHaveProperty('generated_caption')
  })
})

describe('generateIdeaCaption — auto no pisa un draft existente', () => {
  it('devuelve el borrador que ya hay y no llama a la IA', async () => {
    h.idea = { ...h.idea, caption_draft: 'borrador del equipo', generated_caption: null }
    const res = await generateIdeaCaption('i1', { auto: true })
    expect(res).toEqual({ ok: true, caption: 'borrador del equipo' })
    expect(generateCaptionText).not.toHaveBeenCalled()
    expect(h.updates).toHaveLength(0)
  })

  it('tampoco pisa un caption ya aprobado', async () => {
    h.idea = { ...h.idea, caption_draft: null, generated_caption: 'caption listo' }
    const res = await generateIdeaCaption('i1', { auto: true })
    expect(res.caption).toBe('caption listo')
    expect(generateCaptionText).not.toHaveBeenCalled()
    expect(h.updates).toHaveLength(0)
  })

  it('si no hay copy, el auto sí genera un borrador', async () => {
    h.idea = { ...h.idea, caption_draft: null, generated_caption: null }
    const res = await generateIdeaCaption('i1', { auto: true })
    expect(res.ok).toBe(true)
    expect(h.updates[0].caption_draft).toBe(oneDraft)
  })

  it('sin auto, regenerar sí pisa el draft a propósito', async () => {
    h.idea = { ...h.idea, caption_draft: 'viejo', generated_caption: null }
    await generateIdeaCaption('i1')
    expect(generateCaptionText).toHaveBeenCalled()
    expect(h.updates[0].caption_draft).toBe(oneDraft)
  })

  it('si el draft guardado es JSON por red, auto muestra un solo texto', async () => {
    h.idea = {
      ...h.idea,
      caption_draft: packCaptionDrafts([
        { platform: 'instagram', text: 'hook IG' },
        { platform: 'tiktok', text: 'oral TT' },
      ]),
      generated_caption: null,
    }
    const res = await generateIdeaCaption('i1', { auto: true })
    expect(res.caption).toBe('hook IG')
    expect(res.caption).not.toContain('[TikTok]')
    expect(res.caption).not.toContain('"by"')
    expect(generateCaptionText).not.toHaveBeenCalled()
  })
})

describe('generateIdeaCaption — un caption para todas las redes', () => {
  it('llama a la IA una sola vez aunque el cliente tenga varias redes', async () => {
    const client = h.idea.client as { platforms: string[]; default_platforms: string[] }
    h.idea = {
      ...h.idea,
      client: { ...client, platforms: ['instagram', 'tiktok'], default_platforms: ['instagram', 'tiktok'] },
    }

    const res = await generateIdeaCaption('i1')

    expect(generateCaptionText).toHaveBeenCalledTimes(1)
    expect(generateCaptionText).toHaveBeenCalledWith(expect.stringMatching(/un solo caption/i))
    expect(generateCaptionText).toHaveBeenCalledWith(expect.not.stringContaining('RED ESPECÍFICA'))
    expect(h.updates[0].caption_draft).toBe(oneDraft)
    expect(res.caption).toBe(oneDraft)
  })

  it('el próximo generate usa los 👍 como ejemplo y los 👎 como evitar', async () => {
    vi.mocked(fetchCaptionFeedbackForPrompt).mockResolvedValueOnce({
      loved: ['Caption amado con largo suficiente para pasar el piso'],
      avoid: [{ text: 'Caption rechazado con demasiados emojis 🔥🔥🔥', note: 'demasiados emojis' }],
    })
    await generateIdeaCaption('i1')
    const prompt = vi.mocked(generateCaptionText).mock.calls[0][0]
    expect(prompt).toContain('Caption amado con largo suficiente para pasar el piso')
    expect(prompt).toContain('CAPTIONS QUE EL EQUIPO RECHAZÓ')
    expect(prompt).toContain('Caption rechazado con demasiados emojis')
    expect(prompt).toContain('demasiados emojis')
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
