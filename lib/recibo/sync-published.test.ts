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
vi.mock('@/lib/metricool/client', () => ({ getAllSimpleProfiles: vi.fn(async () => []) }))
vi.mock('@/lib/utils/idea-activity', () => ({ logIdeaActivity: (...a: unknown[]) => logIdeaActivity(...(a as [])) }))

type Op = { table: string; kind: 'select' | 'update'; payload?: unknown; filters: string[] }
const ops: Op[] = []
let ideaRows: unknown[] = []
let takenRows: { metricool_post_id: number }[] = []
let updateReturns: unknown = { id: 'x' }

function builder(table: string) {
  const op: Op = { table, kind: 'select', filters: [] }
  ops.push(op)
  const result = () => {
    if (op.kind === 'update') return { data: updateReturns, error: null }
    if (table === 'clients') return { data: [{ id: 'arecibo' }, { id: 'delian' }], error: null }
    if (op.filters.some((f) => f.startsWith('in metricool_post_id'))) return { data: takenRows, error: null }
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
  ops.length = 0
  updateReturns = { id: 'x' }
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
    expect(update.payload).toMatchObject({ metricool_post_id: 381555336, metricool_uuid: 'u381555336', publish_date: '2026-09-24', posting_error: null })
    expect(update.filters).toEqual(['eq id=nuevo', 'is metricool_post_id=null', 'is posted_at=null'])
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
})
