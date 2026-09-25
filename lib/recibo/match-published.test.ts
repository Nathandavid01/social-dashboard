import { describe, expect, it } from 'vitest'
import { matchReciboPublished, measurableMedia, type MatchPost } from './match-published'

// Tamaños reales medidos el 2026-09-25: Metricool guarda el archivo tal cual,
// así que el mismo corte pesa lo mismo en R2 y en static.metricool.com.
const ARECIBO_NUEVO = 17231994
const ARECIBO_DOCTORA = 13220119
const DELIAN_DISENOS = 13322728

const cut = (size: number | null, extra: Record<string, unknown> = {}) => ({ kind: 'edited', status: 'uploaded', size_bytes: size, ...extra })
const idea = (id: string, ...videos: ReturnType<typeof cut>[]) => ({ id, videos })

function post(id: number, url: string, extra: Partial<MatchPost> = {}): MatchPost {
  return {
    id,
    uuid: `u${id}`,
    draft: false,
    media: [url],
    providers: [{ status: 'PUBLISHED' }, { status: 'PUBLISHED' }],
    publicationDate: { dateTime: '2026-09-24T13:59:00' },
    ...extra,
  }
}

function sizes(entries: Record<string, number>) {
  return (url: string) => entries[url]
}

describe('matchReciboPublished', () => {
  it('enlaza el corte con el post publicado del mismo tamaño exacto (Arecibo, 24-sep)', () => {
    const matches = matchReciboPublished(
      [idea('nuevo', cut(ARECIBO_NUEVO)), idea('antes', cut(15802345))],
      [post(381555336, 'https://static.metricool.com/a.mp4')],
      sizes({ 'https://static.metricool.com/a.mp4': ARECIBO_NUEVO }),
    )
    expect(matches.map((m) => [m.ideaId, m.post.id])).toEqual([['nuevo', 381555336]])
  })

  it('lo encuentra aunque el caption publicado sea otro (Conoce a la doctora, 19-sep)', () => {
    const matches = matchReciboPublished(
      [idea('doctora', cut(ARECIBO_DOCTORA))],
      [post(7, 'https://m/d.mp4', { text: '¿Necesitas un laboratorio clínico en Arecibo?', publicationDate: { dateTime: '2026-09-19T18:00:00' } } as Partial<MatchPost>)],
      sizes({ 'https://m/d.mp4': ARECIBO_DOCTORA }),
    )
    expect(matches.map((m) => [m.ideaId, m.post.id])).toEqual([['doctora', 7]])
  })

  it('un borrador en Metricool no saca el video de Recibo (Delian, borrador de Valeria)', () => {
    const matches = matchReciboPublished(
      [idea('disenos', cut(DELIAN_DISENOS))],
      [post(9, 'https://m/v.mp4', { draft: true, providers: [{ status: 'PENDING' }] })],
      sizes({ 'https://m/v.mp4': DELIAN_DISENOS }),
    )
    expect(matches).toEqual([])
  })

  it('programado (no borrador) también salió de Recibo', () => {
    const matches = matchReciboPublished(
      [idea('i', cut(100))],
      [post(1, 'https://m/p.mp4', { providers: [{ status: 'PENDING' }] })],
      sizes({ 'https://m/p.mp4': 100 }),
    )
    expect(matches.map((m) => [m.ideaId, m.post.id])).toEqual([['i', 1]])
  })

  it('si falló en todas las redes, el video no salió', () => {
    const matches = matchReciboPublished(
      [idea('i', cut(100))],
      [post(1, 'https://m/p.mp4', { providers: [{ status: 'ERROR' }, { status: 'ERROR' }] })],
      sizes({ 'https://m/p.mp4': 100 }),
    )
    expect(matches).toEqual([])
  })

  it('si salió en una red y falló en otra, sí salió', () => {
    const matches = matchReciboPublished(
      [idea('i', cut(100))],
      [post(1, 'https://m/p.mp4', { providers: [{ status: 'ERROR' }, { status: 'PUBLISHED' }] })],
      sizes({ 'https://m/p.mp4': 100 }),
    )
    expect(matches.map((m) => [m.ideaId, m.post.id])).toEqual([['i', 1]])
  })

  it('no decide cuando el mismo tamaño está en dos ideas distintas', () => {
    const matches = matchReciboPublished(
      [idea('a', cut(100)), idea('b', cut(100))],
      [post(1, 'https://m/p.mp4')],
      sizes({ 'https://m/p.mp4': 100 }),
    )
    expect(matches).toEqual([])
  })

  it('el mismo archivo repetido dentro de UNA idea sigue siendo esa idea', () => {
    const matches = matchReciboPublished(
      [idea('sushi', cut(8847020), cut(8847020), cut(14943500))],
      [post(1, 'https://m/p.mp4')],
      sizes({ 'https://m/p.mp4': 8847020 }),
    )
    expect(matches.map((m) => m.ideaId)).toEqual(['sushi'])
  })

  it('ignora cortes archivados o fallidos, sin tamaño, y crudos', () => {
    const matches = matchReciboPublished(
      [
        idea('archivado', cut(100, { status: 'archived' })),
        idea('fallido', cut(200, { status: 'failed' })),
        idea('crudo', cut(300, { kind: 'raw' })),
        idea('sin-tamano', cut(null)),
      ],
      [post(1, 'https://m/1.mp4'), post(2, 'https://m/2.mp4'), post(3, 'https://m/3.mp4')],
      sizes({ 'https://m/1.mp4': 100, 'https://m/2.mp4': 200, 'https://m/3.mp4': 300 }),
    )
    expect(matches).toEqual([])
  })

  it('sin tamaño medido del lado de Metricool no hay match', () => {
    expect(matchReciboPublished([idea('i', cut(100))], [post(1, 'https://m/p.mp4')], sizes({}))).toEqual([])
  })

  it('reposteado: prefiere el publicado y, entre publicados, el más reciente', () => {
    const matches = matchReciboPublished(
      [idea('i', cut(100))],
      [
        post(1, 'https://m/1.mp4', { publicationDate: { dateTime: '2026-09-10T10:00:00' } }),
        post(2, 'https://m/2.mp4', { publicationDate: { dateTime: '2026-09-20T10:00:00' } }),
        post(3, 'https://m/3.mp4', { providers: [{ status: 'PENDING' }], publicationDate: { dateTime: '2026-09-30T10:00:00' } }),
      ],
      sizes({ 'https://m/1.mp4': 100, 'https://m/2.mp4': 100, 'https://m/3.mp4': 100 }),
    )
    expect(matches.map((m) => [m.ideaId, m.post.id])).toEqual([['i', 2]])
  })
})

describe('measurableMedia', () => {
  it('solo mide posts que cuentan: un solo video, no borrador, no fallido en todo', () => {
    const posts = [
      post(1, 'https://m/ok.mp4'),
      post(2, 'https://m/borrador.mp4', { draft: true }),
      post(3, 'https://m/foto.jpg'),
      post(4, 'https://m/a.mp4', { media: ['https://m/a.mp4', 'https://m/b.mp4'] }),
      post(5, 'https://m/error.mp4', { providers: [{ status: 'ERROR' }] }),
      post(6, '', { media: [{ url: 'https://m/objeto.MOV?x=1' }] }),
    ]
    expect(measurableMedia(posts)).toEqual(['https://m/ok.mp4', 'https://m/objeto.MOV?x=1'])
  })
})
