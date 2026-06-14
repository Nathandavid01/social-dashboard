import { describe, it, expect } from 'vitest'
import { approvedIdeaSendReadiness, buildScheduledDateTime, quickSendMediaOptions } from './idea-lab-send-core'

describe('quickSendMediaOptions', () => {
  const url = 'https://v.nmedia.dev/quick/c1/edited/1-x.mp4'

  it('attaches the video when a media URL is given', () => {
    expect(quickSendMediaOptions(url, false)).toEqual({ mediaUrls: [url], autoPublish: false })
    expect(quickSendMediaOptions(url, true)).toEqual({ mediaUrls: [url], autoPublish: true })
  })
  it('omits media when there is no video, keeping the chosen publish mode', () => {
    expect(quickSendMediaOptions(null, true)).toEqual({ autoPublish: true })
    expect(quickSendMediaOptions('   ', false)).toEqual({ autoPublish: false })
  })
  it('defaults to a draft (autoPublish=false) when the mode is not given', () => {
    expect(quickSendMediaOptions(url)).toEqual({ mediaUrls: [url], autoPublish: false })
    expect(quickSendMediaOptions()).toEqual({ autoPublish: false })
  })
})

describe('approvedIdeaSendReadiness', () => {
  const ok = { generated_caption: 'Hola mundo', metricool_post_id: null }

  it('is ready with caption + blog id + not yet sent', () => {
    expect(approvedIdeaSendReadiness(ok, 'blog-123')).toEqual({ ready: true })
  })

  it('refuses when already sent (idempotency) before anything else', () => {
    const r = approvedIdeaSendReadiness({ ...ok, metricool_post_id: 42 }, 'blog-123')
    expect(r).toEqual({ ready: false, reason: 'Ya se envió a Metricool' })
  })

  it('refuses when the caption is missing or blank', () => {
    expect(approvedIdeaSendReadiness({ ...ok, generated_caption: null }, 'blog-123').ready).toBe(false)
    expect(approvedIdeaSendReadiness({ ...ok, generated_caption: '   ' }, 'blog-123').reason).toMatch(/caption/i)
  })

  it('refuses when the client has no Metricool blog id', () => {
    expect(approvedIdeaSendReadiness(ok, null).ready).toBe(false)
    expect(approvedIdeaSendReadiness(ok, '   ').reason).toMatch(/Metricool/)
  })
})

describe('buildScheduledDateTime', () => {
  it('combines date + time into a naive local datetime', () => {
    expect(buildScheduledDateTime('2026-06-15', '14:30')).toBe('2026-06-15T14:30:00')
  })

  it('defaults to 10:00 when no time is given', () => {
    expect(buildScheduledDateTime('2026-06-15')).toBe('2026-06-15T10:00:00')
    expect(buildScheduledDateTime('2026-06-15', null)).toBe('2026-06-15T10:00:00')
  })

  it('pads single-digit hours and clamps out-of-range hours', () => {
    expect(buildScheduledDateTime('2026-06-15', '9:05')).toBe('2026-06-15T09:05:00')
    expect(buildScheduledDateTime('2026-06-15', '30:00')).toBe('2026-06-15T23:00:00')
  })

  it('returns null for a missing or malformed date', () => {
    expect(buildScheduledDateTime(null, '10:00')).toBeNull()
    expect(buildScheduledDateTime('', '10:00')).toBeNull()
    expect(buildScheduledDateTime('06/15/2026', '10:00')).toBeNull()
  })

  it('falls back to 10:00 when the time is malformed', () => {
    expect(buildScheduledDateTime('2026-06-15', 'noon')).toBe('2026-06-15T10:00:00')
  })
})
