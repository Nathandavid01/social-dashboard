import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * runReciboPublishedMatch — enlaza los cortes de Recibo que el equipo publicó
 * a mano en Metricool. Contrato: solo toca ideas que están en Recibo y siguen
 * sin enlazar, nunca pisa un envío del dashboard, y un Metricool caído no
 * decide nada.
 */

process.env.METRICOOL_TOKEN = 'tok'
process.env.METRICOOL_USER_ID = 'uid'
process.env.METRICOOL_BLOG_ID = 'blog-default'

const getScheduledPosts = vi.fn()
const logIdeaActivity = vi.fn(async () => {})

vi.mock('@/lib/metricool/scheduler', () => ({ getScheduledPosts: (...a: unknown[]) => getScheduledPosts(...a) }))
let profiles: { id: number; label: string }[] = []
vi.mock('@/lib/metricool/client', () => ({ getAllSimpleProfiles: vi.fn(async () => profiles) }))
vi.mock('@/lib/utils/idea-activity', () => ({ logIdeaActivity: (...a: unknown[]) => logIdeaActivity(...(a as [])) }))

type Op = { table: string; kind: 'select' | 'update'; payload?: unknown; filters: string[] }
const ops: Op[] = []
let ideaRows: unknown[] = []
/** When set, each `range(from, to)` read gets pages[from / 1000]. */
let pages: unknown[][] | null = null
let takenRows: { metricool_post_id: number }[] = []
let takenError: { message: string } | null = null
let clientUpdateError: { message: string } | null = null
let updateReturns: unknown = { id: 'x' }
let clientUpdateReturns: unknown = [{ id: 'arecibo' }]

function builder(table: string) {
  const op: Op = { table, kind: 'select', filters: [] }
  ops.push(op)
  const result = () => {
    if (op.kind === 'update') {
      return table === 'clients'
        ? { data: clientUpdateError ? null : clientUpdateReturns, error: clientUpdateError }
        : { data: updateReturns, error: null }
    }
    if (table === 'clients') return { data: [{ id: 'arecibo' }, { id: 'delian' }], error: null }
    if (op.filters.some((f) => f.startsWith('in metricool_post_id'))) return { data: takenError ? null : takenRows, error: takenError }
    if (pages) return { data: pages[op.filters.some((f) => f.startsWith('gt id=')) ? 1 : 0] ?? [], error: null }
    return { data: ideaRows, error: null }
  }
  const b: Record<string, unknown> = {
    select: () => b,
    update: (payload: unknown) => { op.kind = 'update'; op.payload = payload; return b },
    eq: (col: string, val: unknown) => { op.filters.push(`eq ${col}=${val}`); return b },
    neq: (col: string, val: unknown) => { op.filters.push(`neq ${col}=${val}`); return b },
    is: (col: string, val: unknown) => { op.filters.push(`is ${col}=${val}`); return b },
    not: (col: string, operator: string, val: unknown) => { op.filters.push(`not ${col} ${operator} ${val}`); return b },
    in: (col: string, vals: unknown[]) => { op.filters.push(`in ${col}=${vals.join(',')}`); return b },
    or: (expr: string) => { op.filters.push(`or ${expr}`); return b },
    order: () => b,
    range: (from: number, to: number) => { op.filters.push(`range ${from}-${to}`); return b },
    gt: (col: string, val: unknown) => { op.filters.push(`gt ${col}=${val}`); return b },
    limit: (n: number) => { op.filters.push(`limit ${n}`); return b },
    maybeSingle: async () => result(),
    then: (resolve: (v: unknown) => unknown) => resolve(result()),
  }
  return b
}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: (table: string) => builder(table) }),
}))

const ARECIBO = { status: 'active', name: 'Arecibo Lab', metricool_blog_id: '6278882' }
const cut = (size: number) => ({ kind: 'edited', status: 'uploaded', storage_provider: 'entregas-r2', size_bytes: size, uploaded_at: '2026-09-20T10:00:00Z' })
const onRecibo = (id: string, size: number, extra: Record<string, unknown> = {}) => ({
  id, client_id: 'arecibo', status: 'producida', client: ARECIBO, videos: [cut(size)], ...extra,
})
const post = (id: number, url: string, extra: Record<string, unknown> = {}) => ({
  id, uuid: `u${id}`, draft: false, media: [url], providers: [{ status: 'PUBLISHED' }], publicationDate: { dateTime: '2026-09-24T13:59:00' }, ...extra,
})

let sizes: Record<string, number> = {}

beforeEach(() => {
  vi.clearAllMocks()
  // The module caches measured sizes per URL: a fresh module per test.
  vi.resetModules()
  ops.length = 0
  updateReturns = { id: 'x' }
  clientUpdateReturns = [{ id: 'arecibo' }]
  profiles = []
  pages = null
  takenError = null
  clientUpdateError = null
  takenRows = []
  sizes = {}
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    expect(init?.method).toBe('HEAD')
    const size = sizes[url]
    return new Response(null, { status: size ? 200 : 404, headers: size ? { 'content-length': String(size) } : {} })
  }))
})
afterEach(() => {
  vi.unstubAllGlobals()
})

async function run() {
  const { runReciboPublishedMatch } = await import('./sync-published')
  return runReciboPublishedMatch()
}

const updates = () => ops.filter((op) => op.kind === 'update')

describe('runReciboPublishedMatch', () => {
  it('enlaza el corte publicado a mano con su post y lo registra', async () => {
    ideaRows = [onRecibo('nuevo', 17231994), onRecibo('antes', 15802345)]
    sizes['https://static.metricool.com/a.mp4'] = 17231994
    getScheduledPosts.mockResolvedValue([post(381555336, 'https://static.metricool.com/a.mp4')])

    expect(await run()).toEqual({ linked: 1 })

    expect(getScheduledPosts.mock.calls[0][0]).toMatchObject({ blogId: '6278882' })
    const [update] = updates()
    // posted_at = cuándo se creó/publicó el post en Metricool (hora de PR), no la hora del cruce.
    expect(update.payload).toEqual({
      metricool_post_id: 381555336,
      metricool_uuid: 'u381555336',
      posted_at: '2026-09-24T17:59:00.000Z',
      publish_date: '2026-09-24',
      posting_error: null,
    })
    expect(update.filters).toEqual(['eq id=nuevo', 'is metricool_post_id=null', 'is posted_at=null', 'is posting_started_at=null'])
    expect(logIdeaActivity).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      ideaId: 'nuevo',
      action: 'posted_to_metricool',
      metadata: { source: 'metricool_match', metricoolPostId: 381555336 },
    }))
  })

  it('solo lee ideas sin enlazar ni publicar', async () => {
    ideaRows = []
    await run()
    const read = ops.find((op) => op.table === 'content_ideas' && op.kind === 'select')
    expect(read?.filters).toEqual(expect.arrayContaining([
      'not status in (descartada,publicada)', 'is metricool_post_id=null', 'is posted_at=null', 'is published_at=null',
      'eq videos.kind=edited', 'limit 1000',
    ]))
    expect(getScheduledPosts).not.toHaveBeenCalled()
  })

  it('no toca ideas que no están en Recibo (cliente con editor, sin corte de Eric)', async () => {
    ideaRows = [{ ...onRecibo('humano', 100), client_id: 'otro' }]
    sizes['https://m/p.mp4'] = 100
    getScheduledPosts.mockResolvedValue([post(1, 'https://m/p.mp4')])
    expect(await run()).toEqual({ linked: 0 })
    expect(updates()).toEqual([])
  })

  it('si otra vía lo enlazó entre medio, no cuenta ni registra nada', async () => {
    ideaRows = [onRecibo('nuevo', 100)]
    sizes['https://m/p.mp4'] = 100
    getScheduledPosts.mockResolvedValue([post(1, 'https://m/p.mp4')])
    updateReturns = null
    expect(await run()).toEqual({ linked: 0 })
    expect(logIdeaActivity).not.toHaveBeenCalled()
  })

  it('Metricool caído: no decide nada y lo dice', async () => {
    ideaRows = [onRecibo('nuevo', 100)]
    getScheduledPosts.mockRejectedValue(new Error('502'))
    const res = await run()
    expect(res.linked).toBe(0)
    expect(res.error).toMatch(/Metricool no respondió/)
    expect(updates()).toEqual([])
  })

  it('un borrador en Metricool no enlaza (ni se mide)', async () => {
    ideaRows = [onRecibo('disenos', 13322728)]
    sizes['https://m/v.mp4'] = 13322728
    getScheduledPosts.mockResolvedValue([post(9, 'https://m/v.mp4', { draft: true })])
    expect(await run()).toEqual({ linked: 0 })
    expect(fetch).not.toHaveBeenCalled()
  })
  it('un post que ya es de otra idea no se le pega a un corte de Recibo', async () => {
    ideaRows = [onRecibo('copia', 100)]
    sizes['https://m/p.mp4'] = 100
    getScheduledPosts.mockResolvedValue([post(55, 'https://m/p.mp4')])
    takenRows = [{ metricool_post_id: 55 }]
    expect(await run()).toEqual({ linked: 0 })
    expect(updates()).toEqual([])
  })

  it('consulta Metricool de cada cliente en paralelo; si uno falla, los demás siguen', async () => {
    const DELIAN = { status: 'active', name: 'Dra. Delian Loyola', metricool_blog_id: '6354086' }
    ideaRows = [onRecibo('nuevo', 100), { ...onRecibo('delian', 200), client_id: 'delian', client: DELIAN }]
    const { runReciboPublishedMatch } = await import('./sync-published')
    sizes['https://m/p.mp4'] = 100
    getScheduledPosts.mockImplementation(async (config: { blogId: string }) => {
      if (config.blogId === '6354086') throw new Error('502')
      return [post(1, 'https://m/p.mp4')]
    })
    const res = await runReciboPublishedMatch()
    expect(res).toEqual({ linked: 1, error: 'Metricool no respondió para 1 cliente(s).' })
    expect(getScheduledPosts).toHaveBeenCalledTimes(2)
  })
  it('pagina: más de 1000 ideas candidatas no se cortan en silencio', async () => {
    pages = [Array.from({ length: 1000 }, (_, i) => onRecibo(`p${i}`, 1000 + i)), [onRecibo('ultima', 7)]]
    sizes['https://m/u.mp4'] = 7
    getScheduledPosts.mockResolvedValue([post(1, 'https://m/u.mp4')])
    expect(await run()).toEqual({ linked: 1 })
    // Por id (keyset), no por offset: si otra corrida enlaza ideas a la vez, no se salta ninguna.
    const reads = ops.filter((op) => op.table === 'content_ideas' && op.kind === 'select' && op.filters.includes('limit 1000'))
    expect(reads.map((op) => op.filters.find((f) => f.startsWith('gt id=')) ?? 'primera')).toEqual(['primera', 'gt id=p999'])
    expect(updates()[0].filters[0]).toBe('eq id=ultima')
  })

  it('cliente sin blog guardado: el tamaño prueba cuál es su blog, lo guarda y entonces enlaza', async () => {
    const SIN_BLOG = { status: 'active', name: 'Arecibo Lab', metricool_blog_id: '' }
    ideaRows = [onRecibo('nuevo', 17231994, { client: SIN_BLOG })]
    profiles = [{ id: 6278882, label: 'Arecibo Lab' }]
    sizes['https://m/a.mp4'] = 17231994
    getScheduledPosts.mockResolvedValue([post(381555336, 'https://m/a.mp4')])

    expect(await run()).toEqual({ linked: 1 })

    const clientUpdate = ops.find((op) => op.table === 'clients' && op.kind === 'update')
    expect(clientUpdate?.payload).toEqual({ metricool_blog_id: '6278882' })
    // Compare-and-swap contra el valor que se leyó ('' aquí): nunca pisa uno que alguien guardó entre medio.
    expect(clientUpdate?.filters).toEqual(['eq id=arecibo', 'eq metricool_blog_id='])
    expect(updates().filter((op) => op.table === 'content_ideas')).toHaveLength(1)
  })

  it('si no se pudo guardar el blog del cliente, no enlaza (el sync diario no lo vería)', async () => {
    const SIN_BLOG = { status: 'active', name: 'Arecibo Lab', metricool_blog_id: null }
    ideaRows = [onRecibo('nuevo', 100, { client: SIN_BLOG })]
    profiles = [{ id: 6278882, label: 'Arecibo Lab' }]
    sizes['https://m/a.mp4'] = 100
    getScheduledPosts.mockResolvedValue([post(1, 'https://m/a.mp4')])
    clientUpdateReturns = []
    expect(await run()).toEqual({ linked: 0 })
    expect(updates().filter((op) => op.table === 'content_ideas')).toEqual([])
  })

  it('la ventana sale de los cortes vigentes, no de un crudo o un corte archivado viejo', async () => {
    ideaRows = [onRecibo('i', 100, {
      videos: [
        { kind: 'edited', status: 'archived', size_bytes: 5, uploaded_at: '2025-11-01T10:00:00Z' },
        { kind: 'edited', status: 'uploaded', size_bytes: 100, uploaded_at: '2026-09-20T10:00:00Z' },
      ],
    })]
    getScheduledPosts.mockResolvedValue([])
    await run()
    expect(getScheduledPosts.mock.calls[0][1]).toBe('2026-09-06T10:00:00')
  })
  it('un blog guardado solo con espacios también se completa (compara con el valor leído)', async () => {
    ideaRows = [onRecibo('nuevo', 100, { client: { status: 'active', name: 'Arecibo Lab', metricool_blog_id: '  ' } })]
    profiles = [{ id: 6278882, label: 'Arecibo Lab' }]
    sizes['https://m/a.mp4'] = 100
    getScheduledPosts.mockResolvedValue([post(1, 'https://m/a.mp4')])
    expect(await run()).toEqual({ linked: 1 })
    expect(ops.find((op) => op.table === 'clients' && op.kind === 'update')?.filters).toEqual(['eq id=arecibo', 'eq metricool_blog_id=  '])
  })

  it('si falla guardar el blog, lo dice y no enlaza', async () => {
    ideaRows = [onRecibo('nuevo', 100, { client: { status: 'active', name: 'Arecibo Lab', metricool_blog_id: null } })]
    profiles = [{ id: 6278882, label: 'Arecibo Lab' }]
    sizes['https://m/a.mp4'] = 100
    getScheduledPosts.mockResolvedValue([post(1, 'https://m/a.mp4')])
    clientUpdateError = { message: 'permission denied' }
    const res = await run()
    expect(res.linked).toBe(0)
    expect(res.error).toMatch(/permission denied/)
    expect(updates().filter((op) => op.table === 'content_ideas')).toEqual([])
  })

  it('no guarda el blog si el único post que casa ya es de otra idea', async () => {
    ideaRows = [onRecibo('copia', 100, { client: { status: 'active', name: 'Arecibo Lab', metricool_blog_id: null } })]
    profiles = [{ id: 6278882, label: 'Arecibo Lab' }]
    sizes['https://m/p.mp4'] = 100
    getScheduledPosts.mockResolvedValue([post(55, 'https://m/p.mp4')])
    takenRows = [{ metricool_post_id: 55 }]
    expect(await run()).toEqual({ linked: 0 })
    expect(updates()).toEqual([])
  })

  it('si no se puede comprobar qué posts ya son de otra idea, no enlaza nada', async () => {
    ideaRows = [onRecibo('nuevo', 100)]
    sizes['https://m/p.mp4'] = 100
    getScheduledPosts.mockResolvedValue([post(1, 'https://m/p.mp4')])
    takenError = { message: 'timeout' }
    const res = await run()
    expect(res.linked).toBe(0)
    expect(res.error).toMatch(/timeout/)
    expect(updates()).toEqual([])
  })

  it('pasado el plazo no mide ni escribe nada (el cron sigue con su sync)', async () => {
    ideaRows = [onRecibo('nuevo', 100)]
    sizes['https://m/p.mp4'] = 100
    getScheduledPosts.mockResolvedValue([post(1, 'https://m/p.mp4')])
    const { runReciboPublishedMatch } = await import('./sync-published')
    const res = await runReciboPublishedMatch({ deadline: Date.now() - 1 })
    expect(res).toEqual({ linked: 0, error: 'El cruce de Recibo tardó demasiado.' })
    expect(fetch).not.toHaveBeenCalled()
    expect(updates()).toEqual([])
  })
})
