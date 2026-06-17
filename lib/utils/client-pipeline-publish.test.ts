import { describe, it, expect } from 'vitest'
import {
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
