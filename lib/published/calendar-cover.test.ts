import { describe, expect, it } from 'vitest'
import { calendarCoverUrl } from './calendar-cover'

describe('calendarCoverUrl', () => {
  it('uses the Metricool thumbnail on a VIDEO/REEL instead of the mp4', () => {
    expect(calendarCoverUrl([
      { url: 'https://media.example/ubicacion.mp4', type: 'video', thumbnail: 'https://media.example/ubicacion.jpg' },
    ])).toBe('https://media.example/ubicacion.jpg')
  })

  it('uses the image url of a POST', () => {
    expect(calendarCoverUrl([
      { url: 'https://media.example/pizza.png', type: 'image' },
    ])).toBe('https://media.example/pizza.png')
  })

  it('returns null when the only media is a video file', () => {
    expect(calendarCoverUrl([
      { url: 'https://media.example/cubiertos.mp4', type: 'video' },
    ])).toBeNull()
  })

  it('rejects video files even when they sit in preview or thumbnail fields', () => {
    expect(calendarCoverUrl([
      { url: 'https://media.example/reel.mp4', type: 'video', preview: 'https://media.example/reel.mov', previewUrl: 'https://media.example/reel.webm', thumbnail: 'https://media.example/still.webp' },
    ])).toBe('https://media.example/still.webp')
    expect(calendarCoverUrl([
      { previewUrl: 'https://media.example/only.mp4' },
    ])).toBeNull()
  })

  it('uses the post-level videoThumbnailUrl when media is only the mp4', () => {
    expect(calendarCoverUrl(
      [{ url: 'https://media.example/reel.mp4', type: 'video' }],
      'https://media.example/cover.jpg',
    )).toBe('https://media.example/cover.jpg')
  })

  it('rejects a video file in videoThumbnailUrl', () => {
    expect(calendarCoverUrl(
      [{ url: 'https://media.example/reel.mp4', type: 'video' }],
      'https://media.example/cover.mp4',
    )).toBeNull()
  })

  it('does not invent a cover from empty media', () => {
    expect(calendarCoverUrl(undefined)).toBeNull()
    expect(calendarCoverUrl([])).toBeNull()
  })
})
