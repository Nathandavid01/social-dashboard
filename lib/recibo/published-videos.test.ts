import { describe, expect, it } from 'vitest'
import { countPublishedVideos, isPublishedVideoPost, matchingPublishedPost } from './published-videos'

const video = {
  id: 1,
  draft: false,
  text: 'Nuestro nombre tiene una historia detrás',
  media: ['https://static.metricool.com/video/a.mp4'],
  providers: [{ status: 'PUBLISHED' }],
}

describe('countPublishedVideos', () => {
  it('cuenta solo videos ya publicados', () => {
    expect(countPublishedVideos([
      video,
      { ...video, id: 2, draft: true },
      { ...video, id: 3, media: ['https://static.metricool.com/a.png'] },
      { ...video, id: 4, providers: [{ status: 'PENDING' }] },
    ])).toBe(1)
  })
})

describe('matchingPublishedPost', () => {
  it('exige un solo post y un texto propio del video', () => {
    const other = { ...video, id: 9, text: 'Otro tema de encías y sonrisa' }
    expect(matchingPublishedPost({ title: 'Nigiri Y Sashimi', generated_caption: 'corto' }, [video, other])).toBeNull()
    expect(matchingPublishedPost({
      title: 'Por que Yabuuchi',
      generated_caption: 'Nuestro nombre tiene una historia detrás',
    }, [video, other])?.id).toBe(1)
  })
})
