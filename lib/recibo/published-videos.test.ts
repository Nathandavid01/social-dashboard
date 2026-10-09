import { describe, expect, it } from 'vitest'
import { countPublishedVideos } from './published-videos'

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
