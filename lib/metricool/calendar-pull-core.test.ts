import { describe, expect, it } from 'vitest'
import { ideaCalendarDatePatches, unverifiedClientsForFailedBlogs } from './calendar-pull-core'

describe('ideaCalendarDatePatches', () => {
  it('moves a linked idea onto the Metricool Puerto Rico day', () => {
    expect(ideaCalendarDatePatches(
      [{ id: 'idea-1', metricool_post_id: 44, metricool_uuid: 'u-44', publish_date: '2099-10-01' }],
      [{ id: 44, uuid: 'u-44', publicationDate: { dateTime: '2099-10-20T10:00:00', timezone: 'America/Puerto_Rico' } }],
    )).toEqual([{ id: 'idea-1', publish_date: '2099-10-20' }])
  })

  it('matches by uuid when the numeric id rotated', () => {
    expect(ideaCalendarDatePatches(
      [{ id: 'idea-1', metricool_post_id: 9, metricool_uuid: 'u-44', publish_date: '2099-10-01' }],
      [{ id: 44, uuid: 'u-44', publicationDate: { dateTime: '2099-10-22T18:30:00', timezone: 'America/Puerto_Rico' } }],
    )).toEqual([{ id: 'idea-1', publish_date: '2099-10-22' }])
  })

  it('skips ideas that already sit on the Metricool day', () => {
    expect(ideaCalendarDatePatches(
      [{ id: 'idea-1', metricool_post_id: 44, metricool_uuid: 'u-44', publish_date: '2099-10-20' }],
      [{ id: 44, uuid: 'u-44', publicationDate: { dateTime: '2099-10-20T10:00:00', timezone: 'America/Puerto_Rico' } }],
    )).toEqual([])
  })

  it('does not invent a date when Metricool has no readable publication time', () => {
    expect(ideaCalendarDatePatches(
      [{ id: 'idea-1', metricool_post_id: 44, metricool_uuid: 'u-44', publish_date: '2099-10-01' }],
      [{ id: 44, uuid: 'u-44', publicationDate: { dateTime: 'bad', timezone: 'America/Puerto_Rico' } }],
    )).toEqual([])
  })
})

describe('unverifiedClientsForFailedBlogs', () => {
  it('keeps failed clients visible as sin verificar instead of hiding them', () => {
    expect(unverifiedClientsForFailedBlogs(
      [
        { id: 'a', name: '643 Sport Bar', metricool_blog_id: '111' },
        { id: 'b', name: 'La Güira', metricool_blog_id: '222' },
      ],
      ['222'],
    )).toEqual([{ id: 'b', name: 'La Güira' }])
  })
})
