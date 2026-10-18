import { describe, expect, it } from 'vitest'
import { cadenceFormats, ideaFormat } from './cadence-formats'

describe('ideaFormat', () => {
  it('maps content_type to the format it publishes as', () => {
    expect(ideaFormat('R')).toBe('reel')
    expect(ideaFormat('P')).toBe('post')
    expect(ideaFormat('C')).toBe('post') // carrusel is a feed post
    expect(ideaFormat('S')).toBe('story')
    expect(ideaFormat(null)).toBe('reel') // the default content type is a reel
  })
})

describe('cadenceFormats (JS weekday → format)', () => {
  it('the client calendar (posting_schedule) decides first', () => {
    const f = cadenceFormats([1, 2, 3], { '1': 'reel', '2': 'post', '3': '18:00' }, [])
    expect(f.get(1)).toBe('reel')
    expect(f.get(2)).toBe('post')
    // A time override says nothing about the format.
    expect(f.get(3)).toBeNull()
  })

  it('falls back to production_schedules, converting ISO weekdays (1=Mon..7=Sun)', () => {
    const f = cadenceFormats([0, 3], null, [
      { day_of_week: 7, content_type: 'P' },
      { day_of_week: 3, content_type: 'R' },
    ])
    expect(f.get(0)).toBe('post')
    expect(f.get(3)).toBe('reel')
  })

  it('two different types booked on the same day → either (null)', () => {
    const f = cadenceFormats([1], null, [
      { day_of_week: 1, content_type: 'R' },
      { day_of_week: 1, content_type: 'P' },
    ])
    expect(f.get(1)).toBeNull()
  })

  it('only posting days are in the map', () => {
    const f = cadenceFormats([5], { '1': 'reel' }, [{ day_of_week: 2, content_type: 'R' }])
    expect([...f.keys()]).toEqual([5])
    expect(f.get(5)).toBeNull()
  })
})
