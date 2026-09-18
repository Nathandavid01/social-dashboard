import { describe, expect, it } from 'vitest'
import { primerRoundDraftReadiness } from './draft-readiness'

const ok = {
  caption: 'Hoy en Primer Round junto a Rafael Lenín López y Dennise Pérez.',
  hasVideo: true,
  publicUrl: 'https://cdn.example/edited/a.mp4',
  blogId: '5476146',
  metricoolPostId: null,
  postedAt: null,
}

describe('primerRoundDraftReadiness', () => {
  it('is ready without approval — drafts do not wait for posting.publish', () => {
    expect(primerRoundDraftReadiness(ok)).toEqual({ ready: true })
  })

  it('refuses a second Metricool post', () => {
    expect(primerRoundDraftReadiness({ ...ok, metricoolPostId: 9 }).ready).toBe(false)
    const again = primerRoundDraftReadiness({ ...ok, postedAt: '2026-09-17T12:00:00Z' })
    expect(again.ready).toBe(false)
    if (!again.ready) expect(again.reason).toMatch(/Ya hay un post/i)
  })

  it('requires caption, video, public URL and blog id', () => {
    const caption = primerRoundDraftReadiness({ ...ok, caption: '  ' })
    const video = primerRoundDraftReadiness({ ...ok, hasVideo: false })
    const url = primerRoundDraftReadiness({ ...ok, publicUrl: null })
    const blog = primerRoundDraftReadiness({ ...ok, blogId: '' })
    expect(caption.ready).toBe(false)
    expect(video.ready).toBe(false)
    expect(url.ready).toBe(false)
    expect(blog.ready).toBe(false)
    if (!caption.ready) expect(caption.reason).toMatch(/caption/i)
    if (!video.ready) expect(video.reason).toMatch(/video/i)
    if (!url.ready) expect(url.reason).toMatch(/URL pública/i)
    if (!blog.ready) expect(blog.reason).toMatch(/blog_id/i)
  })
})
