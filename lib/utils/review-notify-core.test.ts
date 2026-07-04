import { describe, it, expect } from 'vitest'
import {
  buildReviewNotification,
  resolveNotifyTargets,
  buildReviewNotificationRows,
} from './review-notify-core'

describe('buildReviewNotification', () => {
  it('builds an approval notice (success)', () => {
    const n = buildReviewNotification({
      event: 'approved',
      clientName: 'Café Pinto',
      videoTitle: 'Promo de verano',
      reviewerName: 'María',
    })
    expect(n.kind).toBe('review_approved')
    expect(n.severity).toBe('success')
    expect(n.title).toBe('Café Pinto aprobó un video')
    expect(n.body).toBe('"Promo de verano" · María')
  })

  it('builds a changes-requested notice (warning)', () => {
    const n = buildReviewNotification({
      event: 'rejected',
      clientName: 'Café Pinto',
      videoTitle: 'Promo de verano',
    })
    expect(n.kind).toBe('review_rejected')
    expect(n.severity).toBe('warning')
    expect(n.title).toBe('Café Pinto pidió cambios')
    expect(n.body).toBe('"Promo de verano"')
  })

  it('builds a comment notice with a preview of the body', () => {
    const n = buildReviewNotification({
      event: 'comment',
      clientName: 'Café Pinto',
      videoTitle: 'Promo',
      reviewerName: 'María',
      commentBody: 'Suban el volumen del audio por favor',
    })
    expect(n.kind).toBe('client_message')
    expect(n.severity).toBe('info')
    expect(n.title).toBe('Café Pinto comentó un video')
    expect(n.body).toBe('María: Suban el volumen del audio por favor')
  })

  it('truncates a long comment body', () => {
    const long = 'a'.repeat(200)
    const n = buildReviewNotification({ event: 'comment', clientName: 'X', commentBody: long })
    expect(n.body.length).toBeLessThanOrEqual(100)
    expect(n.body.endsWith('…')).toBe(true)
  })

  it('falls back gracefully with missing names/titles', () => {
    const n = buildReviewNotification({ event: 'approved', clientName: '', videoTitle: null })
    expect(n.title).toBe('El cliente aprobó un video')
    expect(n.body).toBe('"un video"')
  })
})

describe('resolveNotifyTargets', () => {
  it('merges the assignee with the staff list and dedupes', () => {
    expect(
      resolveNotifyTargets({ assigneeId: 'u1', staffIds: ['u2', 'u1', 'u3'] }).sort(),
    ).toEqual(['u1', 'u2', 'u3'])
  })
  it('works with no assignee', () => {
    expect(resolveNotifyTargets({ assigneeId: null, staffIds: ['u2'] })).toEqual(['u2'])
  })
  it('drops empty ids', () => {
    expect(resolveNotifyTargets({ assigneeId: '', staffIds: ['u2', ''] })).toEqual(['u2'])
  })
  it('returns [] when nobody to notify', () => {
    expect(resolveNotifyTargets({ assigneeId: null, staffIds: [] })).toEqual([])
  })
})

describe('buildReviewNotificationRows', () => {
  it('builds one row per target with the shared notification + link + meta', () => {
    const notif = buildReviewNotification({ event: 'approved', clientName: 'X', videoTitle: 'V' })
    const rows = buildReviewNotificationRows(['u1', 'u2'], notif, '/produccion/idea/idea-1', {
      idea_id: 'idea-1',
    })
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      user_id: 'u1',
      kind: 'review_approved',
      title: 'X aprobó un video',
      link: '/produccion/idea/idea-1',
      severity: 'success',
      meta: { idea_id: 'idea-1' },
    })
    expect(rows[1].user_id).toBe('u2')
  })
})
