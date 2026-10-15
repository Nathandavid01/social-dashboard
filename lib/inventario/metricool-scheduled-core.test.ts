import { describe, expect, it } from 'vitest'
import { toScheduledSlot } from './metricool-scheduled-core'

const today = '2026-10-14'
function post(over: Record<string, unknown> = {}) {
  return {
    id: 77,
    uuid: 'u',
    text: 'Así preparamos el BPT ☕\nlínea 2',
    publicationDate: { dateTime: '2026-10-16T18:00:00', timezone: 'America/Puerto_Rico' },
    providers: [{ network: 'instagram', id: '', status: 'PENDING' }],
    autoPublish: true,
    draft: false,
    ...over,
  }
}

describe('toScheduledSlot (a Metricool planner post → a covered day)', () => {
  it('a pending scheduled post covers its Puerto Rico day, titled by its first caption line', () => {
    expect(toScheduledSlot(post() as never, today)).toEqual({
      id: 77,
      date: '2026-10-16',
      format: 'post',
      title: 'Así preparamos el BPT ☕',
    })
  })

  it('reads reels from the Reel hints or a video file', () => {
    expect(toScheduledSlot(post({ instagramData: { type: 'REEL' } }) as never, today)?.format).toBe('reel')
    expect(toScheduledSlot(post({ facebookData: { type: 'REEL' } }) as never, today)?.format).toBe('reel')
    expect(toScheduledSlot(post({ media: ['https://x/edited/a.mp4'] }) as never, today)?.format).toBe('reel')
    expect(toScheduledSlot(post({ media: ['https://x/a.jpg'] }) as never, today)?.format).toBe('post')
  })

  it('drafts, already-published, failed and past posts do not count as scheduled', () => {
    expect(toScheduledSlot(post({ draft: true }) as never, today)).toBeNull()
    expect(toScheduledSlot(post({ providers: [{ network: 'instagram', id: '', status: 'PUBLISHED' }] }) as never, today)).toBeNull()
    expect(toScheduledSlot(post({ providers: [{ network: 'instagram', id: '', status: 'ERROR' }] }) as never, today)).toBeNull()
    expect(toScheduledSlot(post({ publicationDate: { dateTime: '2026-10-13T18:00:00', timezone: 'America/Puerto_Rico' } }) as never, today)).toBeNull()
  })

  it('a post scheduled for later today still counts', () => {
    expect(toScheduledSlot(post({ publicationDate: { dateTime: '2026-10-14T21:00:00', timezone: 'America/Puerto_Rico' } }) as never, today)?.date).toBe('2026-10-14')
  })
})
