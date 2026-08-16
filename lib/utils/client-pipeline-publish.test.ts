import { describe, it, expect } from 'vitest'
import {
  buildVideoAgendaLine,
  countMetricoolScheduled,
  findNextNewVideoSlot,
  findNextQueuePublish,
  formatScheduledPublish,
} from './client-pipeline-publish'

describe('client-pipeline-publish', () => {
  it('formats publish date with client posting_time', () => {
    expect(formatScheduledPublish('2026-06-18', '14:30', Date.parse('2026-06-10'))).toBe('18 jun 2026 · 14:30')
  })

  it('finds the next upcoming publish in the queue', () => {
    const next = findNextQueuePublish(
      [
        { id: '1', title: 'Old', publish_date: '2026-06-01', metricool_post_id: null },
        { id: '2', title: 'Next', publish_date: '2026-06-20', metricool_post_id: 99 },
      ],
      { postingTime: '10:00' },
      Date.parse('2026-06-10'),
    )
    expect(next?.title).toBe('Next')
    expect(next?.inMetricool).toBe(true)
    expect(next?.whenLabel).toContain('20 jun')
  })

  it('computes the next cadence slot for a new video', () => {
    const slot = findNextNewVideoSlot(
      2,
      { postingDays: [1, 4], postingTime: '09:00' },
      Date.parse('2026-06-09'), // Monday
    )
    expect(slot?.isCadenceSlot).toBe(true)
    expect(slot?.whenLabel).toMatch(/· 09:00/)
  })

  it('counts unpublished videos scheduled in Metricool', () => {
    expect(
      countMetricoolScheduled([
        { id: '1', metricool_post_id: 1, status: 'producida' },
        { id: '2', metricool_post_id: 2, status: 'publicada', published_at: '2026-06-01' },
      ]),
    ).toBe(1)
  })
})

describe('buildVideoAgendaLine', () => {
  const NOW = Date.parse('2026-08-10T00:00:00Z') // a Monday, ahead of the 17th

  it('shows date + time + grouped format for a fully-configured video', () => {
    const line = buildVideoAgendaLine({
      publishDate: '2026-08-17', // Monday
      postingTime: '15:20',
      platforms: ['instagram', 'facebook'],
      platformFormats: { instagram: 'reel', facebook: 'reel' },
      fallbackFormatLabel: 'Reel',
      nowMs: NOW,
    })
    expect(line.hasDate).toBe(true)
    expect(line.dateLabel).toBe('lun 17 ago')
    expect(line.timeConfigured).toBe(true)
    expect(line.timeLabel).toBe('3:20 p. m.')
    expect(line.pastDue).toBe(false)
    expect(line.formatsLabel).toBe('Reel en Instagram y Facebook')
  })

  it('has no date, no time, no format when publish_date is missing (never fabricates)', () => {
    const line = buildVideoAgendaLine({
      publishDate: null,
      postingTime: '15:20',
      platforms: ['instagram', 'facebook'],
      platformFormats: { instagram: 'reel', facebook: 'reel' },
      fallbackFormatLabel: 'Reel',
      nowMs: NOW,
    })
    expect(line.hasDate).toBe(false)
    expect(line.dateLabel).toBeNull()
    expect(line.timeLabel).toBeNull()
    expect(line.formatsLabel).toBeNull()
  })

  it('flags time as not configured instead of defaulting to a fake time', () => {
    const line = buildVideoAgendaLine({
      publishDate: '2026-08-17',
      postingTime: null,
      platforms: ['instagram'],
      platformFormats: { instagram: 'reel' },
      fallbackFormatLabel: 'Reel',
      nowMs: NOW,
    })
    expect(line.hasDate).toBe(true)
    expect(line.timeConfigured).toBe(false)
    expect(line.timeLabel).toBeNull()
  })

  it('prefers a per-day posting_schedule override over the default posting_time', () => {
    const line = buildVideoAgendaLine({
      publishDate: '2026-08-17', // Monday = dayOfWeek 1
      postingTime: '10:00',
      postingSchedule: { '1': '09:05' },
      platforms: ['instagram'],
      fallbackFormatLabel: 'Reel',
      nowMs: NOW,
    })
    expect(line.timeLabel).toBe('9:05 a. m.')
  })

  it('flags a past publish_date as pastDue', () => {
    const line = buildVideoAgendaLine({
      publishDate: '2026-08-01',
      postingTime: '10:00',
      platforms: ['instagram'],
      fallbackFormatLabel: 'Reel',
      nowMs: NOW,
    })
    expect(line.pastDue).toBe(true)
  })

  it('groups platforms with different explicit formats into separate phrases', () => {
    const line = buildVideoAgendaLine({
      publishDate: '2026-08-17',
      postingTime: '10:00',
      platforms: ['instagram', 'facebook'],
      platformFormats: { instagram: 'reel', facebook: 'image' },
      fallbackFormatLabel: 'Reel',
      nowMs: NOW,
    })
    expect(line.formatsLabel).toBe('Reel en Instagram, Imagen en Facebook')
  })

  it('falls back to the content-type label per platform when platform_formats is empty', () => {
    const line = buildVideoAgendaLine({
      publishDate: '2026-08-17',
      postingTime: '10:00',
      platforms: ['instagram', 'facebook'],
      platformFormats: null,
      fallbackFormatLabel: 'Post',
      nowMs: NOW,
    })
    expect(line.formatsLabel).toBe('Post en Instagram y Facebook')
  })

  it('has no formatsLabel when there are no resolved platforms', () => {
    const line = buildVideoAgendaLine({
      publishDate: '2026-08-17',
      postingTime: '10:00',
      platforms: [],
      fallbackFormatLabel: 'Reel',
      nowMs: NOW,
    })
    expect(line.formatsLabel).toBeNull()
  })
})
