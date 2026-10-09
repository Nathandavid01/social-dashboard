import { describe, it, expect } from 'vitest'
import { calendarPostState, calendarPostDate } from './calendar-post'
const post = { draft: false, publicationDate: '2026-10-01T10:00:00', timezone: 'America/Puerto_Rico' }
describe('calendar publication evidence', () => {
  it('does not turn an elapsed date into a published status', () => {
    expect(calendarPostState(post)).toBe('unknown')
    expect(calendarPostState({ ...post, providerStatuses: ['PENDING'] })).toBe('scheduled')
  })
  it('requires every platform to confirm publication and preserves drafts and failures', () => {
    expect(calendarPostState({ ...post, providerStatuses: ['PUBLISHED', 'PENDING'] })).toBe('scheduled')
    expect(calendarPostState({ ...post, providerStatuses: ['PUBLISHED', 'PUBLISHED'] })).toBe('published')
    expect(calendarPostState({ ...post, providerStatuses: ['PUBLISHED', 'ERROR'] })).toBe('error')
    expect(calendarPostState({ ...post, draft: true, providerStatuses: ['PENDING'] })).toBe('draft')
  })
  it('places explicit UTC and source wall times on the Puerto Rico calendar', () => {
    expect(calendarPostDate({ ...post, publicationDate: '2026-10-02T01:00:00Z' })).toBe('2026-10-01T21:00:00')
    expect(calendarPostDate({ ...post, publicationDate: '2026-10-02T01:00:00', timezone: 'Europe/Madrid' })).toBe('2026-10-01T19:00:00')
  })
})
