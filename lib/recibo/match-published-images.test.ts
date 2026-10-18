import { describe, expect, it } from 'vitest'
import { matchReciboPublishedImages, measurableImages } from './match-published-images'

const idea = (id: string, fingerprint: string | undefined, uploaded_at = '2026-10-10') => ({ id, fingerprint, uploaded_at })
const post = (id: number, extra: Record<string, unknown> = {}) => ({ id, draft: false, media: [`https://static.metricool.com/${id}.png`], providers: [{ status: 'PUBLISHED' }], ...extra })

describe('matchReciboPublishedImages', () => {
  it('enlaza una gráfica publicada solo cuando los bytes coinciden', () => {
    expect(matchReciboPublishedImages([idea('i', 'sha256:A')], [post(1)], () => 'sha256:A').map(m => m.ideaId)).toEqual(['i'])
  })
  it('no confunde dos imágenes del mismo tamaño pero bytes distintos', () => {
    expect(matchReciboPublishedImages([idea('i', 'sha256:A')], [post(1)], () => 'sha256:B')).toEqual([])
  })
  it('sin hash comprobado no retira ninguna gráfica', () => {
    expect(matchReciboPublishedImages([idea('i', undefined)], [post(1)], () => undefined)).toEqual([])
  })
  it('no decide si dos ideas tienen exactamente el mismo archivo', () => {
    expect(matchReciboPublishedImages([idea('i', 'A'), idea('j', 'A')], [post(1)], () => 'A')).toEqual([])
  })
  it('los borradores, errores totales y carruseles no retiran una gráfica', () => {
    const posts = [post(1, {draft: true}), post(2, {providers: [{status:'ERROR'}]}), post(3, {media:['https://m/a.png','https://m/b.png']})]
    expect(matchReciboPublishedImages([idea('i','A')],posts,()=> 'A')).toEqual([])
  })
  it('prefiere publicado sobre programado y el publicado más reciente', () => {
    const posts = [post(1,{publicationDate:{dateTime:'2026-10-01'}}),post(2,{publicationDate:{dateTime:'2026-10-02'}}),post(3,{providers:[{status:'PENDING'}],publicationDate:{dateTime:'2026-10-20'}})]
    expect(matchReciboPublishedImages([idea('i','A')],posts,()=> 'A').map(m=>m.post.id)).toEqual([2])
  })
  it('mide imágenes simples elegibles y acepta URLs objeto', () => {
    expect(measurableImages([post(1), post(2,{media:[{url:'https://m/a.JPG?x=1'}]}),post(3,{media:['https://m/a.mp4']}),post(4,{draft:true})])).toEqual(['https://static.metricool.com/1.png','https://m/a.JPG?x=1'])
  })
})
