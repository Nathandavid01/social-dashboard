/**
 * La etapa Copy de /entregas: el overlay carga el borrador, y "Enviar a
 * Publicación" es lo ÚNICO que promueve ese borrador a `generated_caption`
 * (que es lo que `ideaStage()` mira para mover el video de columna).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({
  updates: [] as Record<string, unknown>[],
  client: { name: 'Gym X', caption_notes: 'Lun-Vie 6am', platforms: ['instagram'], default_platforms: [] },
  ideas: [
    {
      id: 'i1',
      title: 'Testimonio',
      hook: 'Bajó 15 lb',
      visual_brief: null,
      caption_angle: null,
      hashtags_suggestion: null,
      generated_caption: null,
      caption_draft: 'Borrador que escribió la IA',
      publish_date: null,
      videos: [],
    },
  ] as Record<string, unknown>[],
  /** Simula "la columna hook_source no existe todavía" (migración 0064 pendiente). */
  hookSourceUpdateThrows: false,
}))

const maybeAutoPostIdea = vi.fn(async (): Promise<{ posted: boolean; skipped?: string } | null> => ({ posted: true }))
vi.mock('@/lib/actions/idea-posting', () => ({
  maybeAutoPostIdea: (...a: unknown[]) => maybeAutoPostIdea(...(a as [])),
}))
vi.mock('@/lib/auth/server', () => ({
  requirePermission: vi.fn(async () => {}),
  currentUserHas: vi.fn(async () => true),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: (table: string) => ({
      // `.eq()` encadena consigo mismo: clients hace .eq().single() y
      // content_ideas hace .eq().eq().order() — y a veces .eq('id', ideaId).
      select: () => {
        let ideaFilter: string | null = null
        const chain: Record<string, unknown> = {
          single: async () => ({ data: h.client, error: null }),
          order: async () => ({
            data: table === 'content_ideas' && ideaFilter
              ? h.ideas.filter((i) => i.id === ideaFilter)
              : h.ideas,
            error: null,
          }),
          maybeSingle: async () => ({
            data: table === 'content_ideas' && ideaFilter
              ? h.ideas.find((i) => i.id === ideaFilter) ?? null
              : null,
            error: null,
          }),
        }
        chain.eq = (col: string, val: unknown) => {
          if (table === 'content_ideas' && col === 'id') ideaFilter = String(val)
          return chain
        }
        return chain
      },
      update: (payload: Record<string, unknown>) => {
        if ('hook_source' in payload && h.hookSourceUpdateThrows) {
          return { eq: async () => { throw new Error('column "hook_source" does not exist') } }
        }
        h.updates.push({ __table: table, ...payload })
        return { eq: async () => ({ error: null }) }
      },
    }),
  }),
}))

import { getEntregaCopyVideos, saveCopyAndSchedule, updateIdeaHook } from './entregas-copy'

beforeEach(() => {
  h.updates.length = 0
  h.hookSourceUpdateThrows = false
  h.ideas = [
    {
      id: 'i1',
      title: 'Testimonio',
      hook: 'Bajó 15 lb',
      visual_brief: null,
      caption_angle: null,
      hashtags_suggestion: null,
      generated_caption: null,
      caption_draft: 'Borrador que escribió la IA',
      publish_date: null,
      videos: [],
    },
  ]
  maybeAutoPostIdea.mockClear()
  maybeAutoPostIdea.mockResolvedValue({ posted: true })
})

describe('getEntregaCopyVideos — el overlay recupera el borrador', () => {
  it('devuelve caption_draft para que el copy generado no se pierda al recargar', async () => {
    const res = await getEntregaCopyVideos('c1')
    expect(res.data?.videos[0].caption_draft).toBe('Borrador que escribió la IA')
    expect(res.data?.videos[0].generated_caption).toBeNull()
  })

  it('con ideaId no trae el video de la semana pasada del mismo cliente', async () => {
    h.ideas = [
      { ...h.ideas[0], id: 'idea-last-week', title: 'Semana pasada' },
      { ...h.ideas[0], id: 'idea-this-week', title: 'Esta semana' },
    ]
    const res = await getEntregaCopyVideos('c1', 'idea-this-week')
    expect(res.data?.videos).toHaveLength(1)
    expect(res.data?.videos[0].id).toBe('idea-this-week')
  })
})

describe('saveCopyAndSchedule — promueve el borrador', () => {
  it('escribe generated_caption con el texto final y limpia el borrador', async () => {
    const res = await saveCopyAndSchedule({ ideaId: 'i1', caption: 'Copy final del equipo', publishDate: '2026-09-01' })
    expect(res.ok).toBe(true)
    expect(h.updates).toHaveLength(1)
    expect(h.updates[0].generated_caption).toBe('Copy final del equipo')
    expect(h.updates[0].caption_draft).toBeNull()
    expect(h.updates[0].publish_date).toBe('2026-09-01')
  })

  it('sigue rechazando el copy vacío', async () => {
    const res = await saveCopyAndSchedule({ ideaId: 'i1', caption: '  ', publishDate: null })
    expect(res.error).toBeTruthy()
    expect(h.updates).toHaveLength(0)
    expect(maybeAutoPostIdea).not.toHaveBeenCalled()
  })

  it('al guardar el copy pide publicar si ya hay video aprobado + Metricool', async () => {
    const res = await saveCopyAndSchedule({ ideaId: 'i1', caption: 'Copy final del equipo', publishDate: '2026-09-01' })
    expect(maybeAutoPostIdea).toHaveBeenCalledWith('i1', { videoFileId: undefined, watchedOn: 'entregas' })
    expect(res.autopost).toEqual({ posted: true })
  })

  it('manda a Metricool el archivo que el copywriter estaba viendo', async () => {
    await saveCopyAndSchedule({
      ideaId: 'i1',
      caption: 'Copy final del equipo',
      publishDate: '2026-09-01',
      videoFileId: 'vid-this-week',
    })
    expect(maybeAutoPostIdea).toHaveBeenCalledWith('i1', { videoFileId: 'vid-this-week', watchedOn: 'entregas' })
  })

  it('si Metricool no está listo, el copy igual se guarda', async () => {
    maybeAutoPostIdea.mockResolvedValueOnce({ posted: false, skipped: 'El cliente no tiene Metricool configurado (falta blog_id)' })
    const res = await saveCopyAndSchedule({ ideaId: 'i1', caption: 'Copy final del equipo', publishDate: null })
    expect(res.ok).toBe(true)
    expect(res.autopost?.posted).toBe(false)
    expect(res.autopost?.skipped).toMatch(/metricool/i)
  })
})

describe('updateIdeaHook — editar el hook a mano limpia hook_source', () => {
  it('el copywriter escribe un hook nuevo → lo guarda y limpia hook_source a null', async () => {
    const res = await updateIdeaHook('i1', 'Un socio cuenta cómo bajó 15 lb')
    expect(res.ok).toBe(true)
    expect(h.updates).toEqual([
      { __table: 'content_ideas', hook: 'Un socio cuenta cómo bajó 15 lb' },
      { __table: 'content_ideas', hook_source: null },
    ])
  })

  it('generar sin cambiar el hook (mismo texto que ya estaba) NO limpia hook_source — el botón "Generar" llama esto en cada click', async () => {
    const res = await updateIdeaHook('i1', 'Bajó 15 lb') // igual al hook actual del fixture
    expect(res.ok).toBe(true)
    expect(h.updates).toEqual([]) // nada cambió: no hay nada que guardar ni que limpiar
  })

  it('si el update de hook_source falla (columna sin migrar), el hook igual se guarda', async () => {
    h.hookSourceUpdateThrows = true
    const res = await updateIdeaHook('i1', 'Un hook distinto')
    expect(res.ok).toBe(true)
    expect(h.updates).toEqual([{ __table: 'content_ideas', hook: 'Un hook distinto' }])
  })
})
