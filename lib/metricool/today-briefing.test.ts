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
it('excludes yesterday returned by Metricool extendedRange', async () => {
 const yesterday = { ...post(['PUBLISHED']), text: 'YESTERDAY', publicationDate: { dateTime: '2026-09-07T14:00:00', timezone: 'America/Puerto_Rico' } }
 const result = await getTodayBriefing(clients, async () => [yesterday, post(['PENDING'])], now)
 expect(result).not.toContain('YESTERDAY')
 expect(result).toContain('PENDING')
})
it.each([
 ['2026-09-09T01:00:00Z','UTC',true],
 ['2026-09-08T01:00:00Z','UTC',false],
 ['2026-09-09T02:00:00','Europe/Madrid',true],
 ['2026-09-08T02:00:00','Europe/Madrid',false],
 ['2026-09-09T01:00:00+02:00','Europe/Madrid',true],
] as const)('normalizes %s in %s to the Puerto Rico day', async (dateTime, timezone, included) => {
 const result = await getTodayBriefing(clients, async () => [{ ...post(['PENDING']), text: 'TARGET', publicationDate: { dateTime, timezone } }], now)
 expect(result.includes('TARGET')).toBe(included)
})
it('marks unparseable dates as incomplete instead of treating them as today', async () => {
 const result = await getTodayBriefing(clients, async () => [{ ...post(['PENDING']), publicationDate: { dateTime: 'bad', timezone: 'Invalid/Zone' } }], now)
 expect(result).toContain('Fecha Sin Verificar')
 expect(result).not.toContain('Sin publicaciones')
})
it.each(['2026-03-08T02:30:00', '2026-02-30T09:00:00'])('does not silently normalize an impossible wall time %s', async dateTime => {
 const result = await getTodayBriefing(clients, async () => [{ ...post(['PENDING']), publicationDate: { dateTime, timezone: 'America/New_York' } }], now)
 expect(result).toContain('Fecha Sin Verificar')
})
