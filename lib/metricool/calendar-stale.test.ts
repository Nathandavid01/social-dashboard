import { describe, expect, it } from 'vitest'
import { calendarPostChanges, puertoRicoWallClock } from './calendar-stale'
const post = { uuid: 'u', draft: true, text: 'Si hoy tienes antojo de calzone 😏📍', publicationDate: { dateTime: '2026-10-23T10:00:00', timezone: 'America/Puerto_Rico' } }
const seen = { uuid: 'u', draft: true, text: post.text, publicationDate: '2026-10-23T10:00:00', timezone: 'America/Puerto_Rico' }
describe('calendarPostChanges', () => {
  it('accepts the same post', () => expect(calendarPostChanges(post, seen)).toEqual([]))
  // Eric 2026-10-19: the calendar list converts dates to Puerto Rico; the single read keeps the stored zone and format.
  it('treats the same instant in another zone or format as unchanged', () => {
    expect(calendarPostChanges({ ...post, publicationDate: { dateTime: '2026-10-23T14:00:00', timezone: 'UTC' } }, seen)).toEqual([])
    expect(calendarPostChanges({ ...post, publicationDate: { dateTime: '2026-10-23T10:00:00', timezone: 'America/New_York' } }, seen)).toEqual([])
    expect(calendarPostChanges({ ...post, publicationDate: { dateTime: '2026-10-23T10:00:00.000', timezone: 'America/Puerto_Rico' } }, { ...seen, publicationDate: '2026-10-23T10:00' })).toEqual([])
  })
  it('ignores line-ending, unicode-form and edge whitespace differences in the caption', () => {
    expect(calendarPostChanges({ ...post, text: 'Línea 1\r\nLínea 2 ' }, { ...seen, text: 'Línea 1\nLínea 2' })).toEqual([])
  })
  it('still detects real changes', () => {
    expect(calendarPostChanges({ ...post, uuid: 'x' }, seen)).toEqual(['uuid'])
    expect(calendarPostChanges({ ...post, draft: false }, seen)).toEqual(['draft'])
    expect(calendarPostChanges({ ...post, text: 'Otro caption' }, seen)).toEqual(['text'])
    expect(calendarPostChanges({ ...post, publicationDate: { dateTime: '2026-10-23T11:00:00', timezone: 'America/Puerto_Rico' } }, seen)).toEqual(['publicationDate'])
    expect(calendarPostChanges({ ...post, publicationDate: { dateTime: 'bad', timezone: 'America/Puerto_Rico' } }, seen)).toEqual(['publicationDate'])
  })
})
describe('puertoRicoWallClock', () => {
  it('shows the stored instant as Puerto Rico wall time', () => {
    expect(puertoRicoWallClock('2099-10-21T03:00:00', 'UTC')).toBe('2099-10-20T23:00')
    expect(puertoRicoWallClock('2099-10-20T10:00:00', 'America/Puerto_Rico')).toBe('2099-10-20T10:00')
    expect(puertoRicoWallClock('bad', 'UTC')).toBeNull()
    // Bugbot 2026-10-19: an absolute timestamp keeps its own instant whatever the zone label says.
    expect(puertoRicoWallClock('2099-10-21T03:00:00Z', 'America/New_York')).toBe('2099-10-20T23:00')
    expect(puertoRicoWallClock('2099-10-20T23:00:00-04:00', 'UTC')).toBe('2099-10-20T23:00')
  })
})
