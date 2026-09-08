import { expect, it, vi } from 'vitest'
import { getTodayBriefing } from './today-briefing'
import type { ScheduledPost } from './scheduler'
const now = new Date('2026-09-09T01:00:00Z') // Sept 8, 9 PM in Puerto Rico
const clients = [{ name: 'Client', metricool_blog_id: '1' }]
const post = (statuses: string[], draft = false) => ({ id: 1, text: 'Video', draft, publicationDate: { dateTime: '2026-09-08T09:00:00', timezone: 'America/Puerto_Rico' }, providers: statuses.map(status => ({ network: 'instagram', status })) }) as ScheduledPost
it('uses the Puerto Rico day even when UTC is already tomorrow', async () => {
 const fetchPosts = vi.fn(async () => [])
 await getTodayBriefing(clients, fetchPosts, now)
 expect(fetchPosts).toHaveBeenCalledWith('1', '2026-09-08T00:00:00', '2026-09-08T23:59:59')
})
it.each([['PENDING'], ['ERROR'], ['PUBLISHED','PENDING'], []].map(statuses => ({ statuses })))('does not infer publication from a past time: %j', async ({ statuses }) => {
 const result = await getTodayBriefing(clients, async () => [post(statuses)], now)
 expect(result).not.toContain('Publicado Confirmado')
})
it('recognizes publication only when every network confirms it', async () => {
 expect(await getTodayBriefing(clients, async () => [post(['PUBLISHED'])], now)).toContain('Publicado Confirmado')
})
it('labels drafts separately', async () => {
 expect(await getTodayBriefing(clients, async () => [post(['PUBLISHED'], true)], now)).toContain('Borrador')
})
it('reports failed client reads as incomplete, never as an empty successful agenda', async () => {
 const result = await getTodayBriefing(clients, async () => { throw Error('401') }, now)
 expect(result).toContain('Consulta Incompleta')
 expect(result).not.toContain('Sin publicaciones')
})
it('retains posts without text and exposes partial network status', async () => {
 const result = await getTodayBriefing(clients, async () => [{ ...post(['PUBLISHED','ERROR']), text: '' }], now)
 expect(result).toContain('ERROR')
 expect(result).toContain('PUBLISHED')
 expect(result).toContain('Sin texto')
})
