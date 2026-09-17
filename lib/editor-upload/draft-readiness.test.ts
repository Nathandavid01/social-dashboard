import { describe, expect, it } from 'vitest'
import { editorDraftReadiness } from './draft-readiness'

const ok = {
  caption: 'Hoy en Primer Round junto a Rafael Lenín López y Dennise Pérez.',
  hasVideo: true,
  publicUrl: 'https://cdn.example/edited/a.mp4',
  blogId: '5476146',
  metricoolPostId: null,
  postedAt: null,
}

describe('editorDraftReadiness', () => {
  it('is ready without approval — drafts do not wait for posting.publish', () => {
    expect(editorDraftReadiness(ok)).toEqual({ ready: true })
  })

  it('refuses a second Metricool post', () => {
    expect(editorDraftReadiness({ ...ok, metricoolPostId: 9 }).ready).toBe(false)
    const again = editorDraftReadiness({ ...ok, postedAt: '2026-09-17T12:00:00Z' })
    expect(again.ready).toBe(false)
    if (!again.ready) expect(again.reason).toMatch(/Ya hay un post/i)
  })

  it('requires caption, video, public URL and blog id', () => {
    const caption = editorDraftReadiness({ ...ok, caption: '  ' })
    const video = editorDraftReadiness({ ...ok, hasVideo: false })
    const url = editorDraftReadiness({ ...ok, publicUrl: null })
    const blog = editorDraftReadiness({ ...ok, blogId: '' })
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
