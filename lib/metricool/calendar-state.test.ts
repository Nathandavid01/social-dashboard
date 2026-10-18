import { describe, expect, it } from 'vitest'
import { buildCalendarStateUpdate } from './calendar-state'
const post = { id: 4, uuid: 'u', text: 'Caption', draft: false, autoPublish: true, providers: [{ network: 'instagram', status: 'PENDING' }], media: ['original.mp4'], instagramData: { type: 'REEL', collaborators: [{ username: 'host' }] }, publicationDate: { dateTime: '2026-10-20T10:00:00', timezone: 'America/Puerto_Rico' } }
describe('Metricool draft and scheduling transitions', () => {
  it('turns the same post into a draft without losing media or platform options', () => {
    const update = buildCalendarStateUpdate(post, 'draft')
    expect(update).toMatchObject({ id: 4, uuid: 'u', draft: true, autoPublish: false, media: post.media, instagramData: post.instagramData, publicationDate: post.publicationDate })
  })
  it('schedules automatic publication at the exact chosen Puerto Rico wall time', () => {
    expect(buildCalendarStateUpdate({ ...post, draft: true }, 'schedule', '2026-10-22T18:30', new Date('2026-10-08T12:00:00Z'))).toMatchObject({ draft: false, autoPublish: true, publicationDate: { dateTime: '2026-10-22T18:30:00', timezone: 'America/Puerto_Rico' } })
  })
  it('rejects invalid and elapsed dates rather than publishing immediately', () => {
    for (const date of ['2026-02-30T10:00', '2026-10-22T25:00', '2020-01-01T10:00', '']) expect(() => buildCalendarStateUpdate(post, 'schedule', date, new Date('2026-10-08T12:00:00Z'))).toThrow()
  })
  it('cannot rewind a published post or change a post currently being published', () => {
    for (const status of ['PUBLISHED', 'PUBLISHING', 'UNKNOWN']) expect(() => buildCalendarStateUpdate({ ...post, providers: [{ network: 'instagram', status }] }, 'draft')).toThrow()
  })
})
