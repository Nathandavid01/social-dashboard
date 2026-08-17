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
  // Base inmutable: cada test parte de aquí (beforeEach), no del h.idea de la
  // corrida anterior — mutar h.idea.hook en un test no debe filtrarse al siguiente.
  ideaBase: {
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
  idea: {} as Record<string, unknown>,
  videos: [
    {
      id: 'v1',
      kind: 'raw',
      status: 'uploaded',
      drive_file_id: 'ideas/1/raw/a.mp4',
      storage_provider: 'r2',
    },
  ],
  analysis: null as { findings: unknown; visual_summary: string | null; status: string } | null,
  // Otras ideas del mismo cliente ya con caption (hermanos del lote, auto-fetch).
  siblings: [] as Record<string, unknown>[],
  // Correcciones del equipo para este cliente (aprendizaje por corrección).
  corrections: [] as Record<string, unknown>[],
  correctionInserts: [] as Record<string, unknown>[],
  correctionsTableBroken: false,
  user: { id: 'u1' } as { id: string } | null,
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
// Stub chainable que sirve tanto para el select-por-id (.eq().single()) como
// para el select-de-lista (.eq().neq().order().limit()) sin importar el orden
// exacto de los filtros — cada método intermedio devuelve el mismo objeto.
function chainStub(single: unknown, list: unknown[]) {
  const obj: Record<string, unknown> = {
    eq: () => obj,
    neq: () => obj,
    is: () => obj,
    order: () => obj,
    limit: async () => ({ data: list, error: null }),
    single: async () => ({ data: single, error: null }),
  }
  return obj
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: h.user } }) },
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
      if (table === 'content_idea_video_analysis') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => ({
                  limit: () => ({
                    maybeSingle: async () => ({ data: h.analysis, error: null }),
                  }),
                }),
              }),
            }),
          }),
        }
      }
      if (table === 'caption_corrections') {
        if (h.correctionsTableBroken) {
          return {
            select: () => { throw new Error('relation "caption_corrections" does not exist') },
            insert: async () => { throw new Error('relation "caption_corrections" does not exist') },
          }
        }
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: async () => ({ data: h.corrections, error: null }),
              }),
            }),
          }),
          insert: async (payload: Record<string, unknown>) => {
            h.correctionInserts.push(payload)
            return { error: null }
          },
        }
      }
      if (table === 'content_ideas') {
        return {
          select: () => chainStub(h.idea, h.siblings),
          update: (payload: Record<string, unknown>) => {
            h.updates.push(payload)
            return { eq: async () => ({ error: null }) }
          },
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
import { logIdeaActivity } from '@/lib/utils/idea-activity'
import { packCaptionDrafts } from '@/lib/utils/caption-draft'
import { generateIdeaCaption, saveIdeaCaption } from './idea-captions'

const oneDraft = 'Caption recién salido de la IA'

beforeEach(() => {
  h.updates.length = 0
  h.idea = { ...h.ideaBase, caption_draft: null, generated_caption: null }
  h.analysis = null
  h.siblings = []
  h.corrections = []
  h.correctionInserts.length = 0
  h.correctionsTableBroken = false
  h.user = { id: 'u1' }
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

describe('generateIdeaCaption — el análisis visual reemplaza el hook', () => {
  it('sin hook pero con análisis visual done: genera igual (Eric: el hook queda para uso manual)', async () => {
    h.idea = { ...h.idea, hook: null }
    h.analysis = { findings: { burned_captions: { text: '' } }, visual_summary: 'persona cocina picanha en parrilla', status: 'done' }
    const res = await generateIdeaCaption('i1')
    expect(res.ok).toBe(true)
    expect(res.error).toBeUndefined()
    expect(h.updates[0].caption_draft).toBe(oneDraft)
  })

  it('sin hook y sin análisis: sigue devolviendo el error de siempre', async () => {
    h.idea = { ...h.idea, hook: null }
    h.analysis = null
    const res = await generateIdeaCaption('i1')
    expect(res.error).toMatch(/de qué es el video/i)
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

describe('generateIdeaCaption — hermanos del lote (Pieza 1)', () => {
  it('sin hermanos explícitos, busca por su cuenta otras ideas del cliente que ya tengan caption', async () => {
    h.siblings = [
      { id: 'i2', title: 'Video 2', caption_draft: null, generated_caption: 'Otro caption ya listo del lote', status: 'activa', published_at: null },
    ]
    await generateIdeaCaption('i1')
    const prompt = vi.mocked(generateCaptionText).mock.calls[0][0]
    expect(prompt).toContain('OTROS CAPTIONS DE ESTE MISMO LOTE')
    expect(prompt).toContain('Otro caption ya listo del lote')
  })

  it('ignora hermanos descartados, publicados o sin caption', async () => {
    h.siblings = [
      { id: 'i2', title: 'Descartada', caption_draft: 'algo', generated_caption: null, status: 'descartada', published_at: null },
      { id: 'i3', title: 'Publicada', caption_draft: null, generated_caption: 'algo publicado', status: 'activa', published_at: '2026-01-01' },
      { id: 'i4', title: 'Sin caption', caption_draft: null, generated_caption: null, status: 'activa', published_at: null },
    ]
    await generateIdeaCaption('i1')
    const prompt = vi.mocked(generateCaptionText).mock.calls[0][0]
    expect(prompt).not.toContain('OTROS CAPTIONS DE ESTE MISMO LOTE')
  })

  it('hermanos explícitos (opts) tienen prioridad sobre el auto-fetch (llamada en lote)', async () => {
    h.siblings = [
      { id: 'i2', title: 'No debe aparecer', caption_draft: null, generated_caption: 'Caption que no debe verse', status: 'activa', published_at: null },
    ]
    await generateIdeaCaption('i1', { hermanos: [{ titulo: 'Video A', caption: 'Caption pasado explícitamente' }] })
    const prompt = vi.mocked(generateCaptionText).mock.calls[0][0]
    expect(prompt).toContain('Caption pasado explícitamente')
    expect(prompt).not.toContain('Caption que no debe verse')
  })

  it('hermanos explícitos vacíos ([]) no dispara auto-fetch ni muestra el bloque', async () => {
    h.siblings = [
      { id: 'i2', title: 'No debe aparecer', caption_draft: null, generated_caption: 'Caption que no debe verse', status: 'activa', published_at: null },
    ]
    await generateIdeaCaption('i1', { hermanos: [] })
    const prompt = vi.mocked(generateCaptionText).mock.calls[0][0]
    expect(prompt).not.toContain('OTROS CAPTIONS DE ESTE MISMO LOTE')
  })
})

describe('generateIdeaCaption — red de seguridad de choque (Pieza 2)', () => {
  it('si el primer intento choca con un hermano, regenera EXACTAMENTE una vez', async () => {
    const hermano = 'Mira este antojo ya\nComenta si te gusta\n#comida #pr'
    vi.mocked(generateCaptionText)
      .mockReset()
      .mockResolvedValueOnce('Mira este antojo ya\nComenta qué opinas\n#comida #pr') // choca (misma primera línea)
      .mockResolvedValueOnce('Un ángulo completamente distinto de verdad\nReserva tu cita\n#otronegocio')
    const res = await generateIdeaCaption('i1', { hermanos: [{ titulo: 'H', caption: hermano }] })
    expect(generateCaptionText).toHaveBeenCalledTimes(2)
    expect(res.caption).toBe('Un ángulo completamente distinto de verdad\nReserva tu cita\n#otronegocio')
    const retryPrompt = vi.mocked(generateCaptionText).mock.calls[1][0]
    expect(retryPrompt).toMatch(/se pareció demasiado/i)
  })

  it('si no choca, genera una sola vez', async () => {
    const hermano = 'Detrás de cámaras del proceso\nGuarda este post\n#bts'
    await generateIdeaCaption('i1', { hermanos: [{ titulo: 'H', caption: hermano }] })
    expect(generateCaptionText).toHaveBeenCalledTimes(1)
  })

  it('si el segundo intento vuelve a chocar, se acepta igual y queda constancia en el log', async () => {
    const hermano = 'Mira este antojo ya\nComenta qué opinas\n#comida'
    vi.mocked(generateCaptionText).mockReset().mockResolvedValue('Mira este antojo ya\nComenta qué opinas\n#comida')
    const res = await generateIdeaCaption('i1', { hermanos: [{ titulo: 'H', caption: hermano }] })
    expect(generateCaptionText).toHaveBeenCalledTimes(2) // no bucle infinito
    expect(res.ok).toBe(true)
    const calls = vi.mocked(logIdeaActivity).mock.calls
    const activity = calls[calls.length - 1][1] as { metadata?: Record<string, unknown> }
    expect(activity.metadata?.anguloChocado).toBe(true)
  })
})

describe('generateIdeaCaption — correcciones del equipo por cliente (Pieza 3)', () => {
  it('incluye las correcciones del cliente en el prompt', async () => {
    h.corrections = [{ draft_text: 'Compra ya con descuento', final_text: 'Reserva tu cita hoy', created_at: '2026-01-01' }]
    await generateIdeaCaption('i1')
    const prompt = vi.mocked(generateCaptionText).mock.calls[0][0]
    expect(prompt).toContain('CORRECCIONES DEL EQUIPO PARA ESTE CLIENTE')
    expect(prompt).toContain('Reserva tu cita hoy')
  })
})

describe('saveIdeaCaption — aprendizaje por corrección (Pieza 3)', () => {
  it('inserta la corrección cuando el texto final difiere de forma significativa del borrador', async () => {
    h.idea = { ...h.idea, client_id: 'c1', caption_draft: 'Compra ya con descuento especial' }
    await saveIdeaCaption('i1', 'Reserva tu cita esta semana')
    expect(h.correctionInserts).toHaveLength(1)
    expect(h.correctionInserts[0]).toMatchObject({
      client_id: 'c1',
      idea_id: 'i1',
      draft_text: 'Compra ya con descuento especial',
      final_text: 'Reserva tu cita esta semana',
      corrected_by: 'u1',
    })
  })

  it('NO inserta nada cuando el texto final es igual al borrador (solo espaciado/mayúsculas)', async () => {
    h.idea = { ...h.idea, client_id: 'c1', caption_draft: 'Un caption cualquiera' }
    await saveIdeaCaption('i1', '  UN caption   cualquiera  ')
    expect(h.correctionInserts).toHaveLength(0)
  })

  it('sin borrador previo, no inserta corrección (nada que "corregir")', async () => {
    h.idea = { ...h.idea, client_id: 'c1', caption_draft: null }
    await saveIdeaCaption('i1', 'Caption escrito desde cero por el equipo')
    expect(h.correctionInserts).toHaveLength(0)
  })

  it('si la tabla caption_corrections falla (migración sin aplicar), el guardado del caption sigue funcionando', async () => {
    h.idea = { ...h.idea, client_id: 'c1', caption_draft: 'Compra ya con descuento especial' }
    h.correctionsTableBroken = true
    const res = await saveIdeaCaption('i1', 'Reserva tu cita esta semana')
    expect(res.ok).toBe(true)
    expect(h.correctionInserts).toHaveLength(0)
    expect(h.updates[h.updates.length - 1].generated_caption).toBe('Reserva tu cita esta semana')
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
