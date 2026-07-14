import { describe, it, expect } from 'vitest'
import {
  buildMyDay,
  bucketFor,
  videoDueDate,
  videoOwnerId,
  myDayHeadline,
  myDayCapacityNote,
  type OwnedVideo,
} from './my-day-core'
import type { BatchVideo } from '@/lib/utils/batch-view'

const ME = 'user-me'
const OTHER = 'user-other'

const TODAY = '2026-07-13'

/** A video that needs MY hands: no caption yet → "Siguiente: genera el caption". */
function video(over: Partial<OwnedVideo> & { id: string }): OwnedVideo {
  return {
    title: over.id,
    status: 'grabada',
    approval_status: 'pending',
    generated_caption: null,
    published_at: null,
    publish_date: null,
    metricool_post_id: null,
    posting_error: null,
    recording_date: null,
    videos: { raw: [], broll: [], edited: [] },
    ...over,
  } as unknown as OwnedVideo
}

/** Mine by default, so bucket/capacity tests don't have to say so every time. */
function mine(over: Partial<OwnedVideo> & { id: string }): OwnedVideo {
  return video({ production_task: { id: 't1', status: 'pendiente', publish_date: '2026-07-13', assigned_to_id: ME }, ...over })
}

describe('videoDueDate', () => {
  it('prefers the human-set deadline over the publish date', () => {
    expect(
      videoDueDate(video({ id: 'a', deadline: '2026-07-10', publish_date: '2026-07-20' } as never)),
    ).toBe('2026-07-10')
  })

  it('falls back to the publish date', () => {
    expect(videoDueDate(video({ id: 'a', publish_date: '2026-07-20' }))).toBe('2026-07-20')
  })

  it('is null when neither is set', () => {
    expect(videoDueDate(video({ id: 'a' }))).toBeNull()
  })
})

describe('bucketFor', () => {
  it('is atrasado when the due date has passed', () => {
    expect(bucketFor(video({ id: 'a', publish_date: '2026-07-01' }), TODAY)).toBe('atrasado')
  })

  it('is hoy when it is due today', () => {
    expect(bucketFor(video({ id: 'a', publish_date: TODAY }), TODAY)).toBe('hoy')
  })

  it('is proximo when it is due later', () => {
    expect(bucketFor(video({ id: 'a', publish_date: '2026-07-30' }), TODAY)).toBe('proximo')
  })

  it('is proximo (not hoy) when it has no due date at all', () => {
    expect(bucketFor(video({ id: 'a' }), TODAY)).toBe('proximo')
  })

  // The load number is the whole point of the screen. Work I cannot move must
  // never inflate it — even when it's overdue.
  it('is esperando when the video is with the client, even if overdue', () => {
    const withClient = video({ id: 'a', approval_status: 'submitted', publish_date: '2026-07-01' })
    expect(bucketFor(withClient, TODAY)).toBe('esperando')
  })
})

describe('videoOwnerId', () => {
  it('is the person assigned to the video', () => {
    expect(videoOwnerId(video({ id: 'a', production_task: { id: 't1', status: 'pendiente', publish_date: '2026-07-13', assigned_to_id: ME } }))).toBe(ME)
  })

  // How the agency really works: "Anibeliz lleva estos 12 clientes".
  it('falls back to whoever runs the client', () => {
    expect(videoOwnerId(video({ id: 'a', client: { id: 'c1', name: 'Cliente', industry: null, assigned_to: ME } }))).toBe(ME)
  })

  // A single video can be handed off without moving the whole account.
  it('lets a per-video assignment beat the client owner', () => {
    const v = video({
      id: 'a',
      production_task: { id: 't1', status: 'pendiente', publish_date: '2026-07-13', assigned_to_id: ME },
      client: { id: 'c2', name: 'Otro', industry: null, assigned_to: OTHER },
    })
    expect(videoOwnerId(v)).toBe(ME)
  })

  it('is null when nobody owns it', () => {
    expect(videoOwnerId(video({ id: 'a' }))).toBeNull()
  })
})

// Most of the real board is planned slots that were never shot. They are work,
// but CAMERA work — and letting them into the load buries the real videos under
// a wall of red (150 fake "atrasados" on the live data).
describe('planned slots that were never shot', () => {
  const slot = (id: string, due: string) =>
    video({ id, status: 'idea', publish_date: due, production_task: { id: 't', status: 'pendiente', publish_date: due, assigned_to_id: ME } })

  it('goes to por_grabar, never to atrasado — no matter how old', () => {
    expect(bucketFor(slot('a', '2026-01-01'), TODAY)).toBe('por_grabar')
  })

  it('never counts against the daily load', () => {
    const day = buildMyDay(
      [slot('s1', '2026-07-01'), slot('s2', '2026-07-01'), mine({ id: 'real', publish_date: TODAY })],
      { today: TODAY, userId: ME, capacity: 1 },
    )
    expect(day.porGrabar).toHaveLength(2)
    expect(day.atrasados).toHaveLength(0)
    expect(day.load.count).toBe(1)
    expect(day.load.over).toBe(false)
  })

  it('says the next step is to SHOOT it, not to write a caption', () => {
    const day = buildMyDay([slot('s1', TODAY)], { today: TODAY, userId: ME })
    expect(day.porGrabar[0].nextStep.label).toMatch(/graba el video/i)
  })
})

describe('buildMyDay', () => {
  it('counts only what needs my hands today (atrasados + hoy)', () => {
    const day = buildMyDay(
      [
        mine({ id: 'late', publish_date: '2026-07-01' }),
        mine({ id: 'today', publish_date: TODAY }),
        mine({ id: 'later', publish_date: '2026-07-30' }),
        mine({ id: 'client', approval_status: 'submitted', publish_date: '2026-07-01' }),
      ],
      { today: TODAY, userId: ME },
    )
    expect(day.scope).toBe('mio')
    expect(day.atrasados.map((i) => i.video.id)).toEqual(['late'])
    expect(day.hoy.map((i) => i.video.id)).toEqual(['today'])
    expect(day.proximos.map((i) => i.video.id)).toEqual(['later'])
    expect(day.esperando.map((i) => i.video.id)).toEqual(['client'])
    // 'later' and 'client' don't count — the number must be trustworthy.
    expect(day.load.count).toBe(2)
  })

  it('drops finished videos — this is a to-do list, not a history', () => {
    const day = buildMyDay(
      [
        mine({ id: 'published', published_at: '2026-07-01T00:00:00Z' }),
        mine({ id: 'scheduled', metricool_post_id: 123 }),
        mine({ id: 'discarded', status: 'descartada', publish_date: TODAY }),
        mine({ id: 'real', publish_date: TODAY }),
      ],
      { today: TODAY, userId: ME },
    )
    expect(day.load.count).toBe(1)
    expect(day.hoy.map((i) => i.video.id)).toEqual(['real'])
  })

  it('sorts each bucket soonest-first', () => {
    const day = buildMyDay(
      [
        mine({ id: 'b', publish_date: '2026-07-05' }),
        mine({ id: 'a', publish_date: '2026-07-02' }),
        mine({ id: 'c', publish_date: '2026-07-08' }),
      ],
      { today: '2026-07-13', userId: ME },
    )
    expect(day.atrasados.map((i) => i.video.id)).toEqual(['a', 'b', 'c'])
  })

  it('carries the honest next step for each video', () => {
    const day = buildMyDay([mine({ id: 'a', publish_date: TODAY })], { today: TODAY, userId: ME })
    expect(day.hoy[0].nextStep.label).toMatch(/caption/i)
  })

  it("shows only MY videos, not a teammate's", () => {
    const day = buildMyDay(
      [
        mine({ id: 'mine', publish_date: TODAY }),
        video({ id: 'theirs', publish_date: TODAY, client: { id: 'c2', name: 'Otro', industry: null, assigned_to: OTHER } }),
      ],
      { today: TODAY, userId: ME },
    )
    expect(day.hoy.map((i) => i.video.id)).toEqual(['mine'])
  })

  // Day one: nothing is assigned yet. An empty screen would be useless, so fall
  // back to the team's UNOWNED work — and say so via `scope`.
  describe('when I have nothing assigned', () => {
    const unowned = video({ id: 'free', publish_date: TODAY })
    const theirs = video({ id: 'theirs', publish_date: TODAY, client: { id: 'c2', name: 'Otro', industry: null, assigned_to: OTHER } })

    it('falls back to the team\'s open work', () => {
      const day = buildMyDay([unowned, theirs], { today: TODAY, userId: ME })
      expect(day.scope).toBe('equipo')
      expect(day.hoy.map((i) => i.video.id)).toEqual(['free'])
    })

    // Someone else's assigned video is not mine to pick up — showing it would
    // just recreate the noisy all-videos board.
    it("does NOT show work already owned by someone else", () => {
      const day = buildMyDay([theirs], { today: TODAY, userId: ME })
      expect(day.scope).toBe('equipo')
      expect(day.hoy).toHaveLength(0)
    })

    // The team pool is not my personal load, so my ceiling must not cry wolf.
    it('never warns about my capacity on the team pool', () => {
      const day = buildMyDay(
        [unowned, video({ id: 'free2', publish_date: TODAY })],
        { today: TODAY, userId: ME, capacity: 1 },
      )
      expect(day.scope).toBe('equipo')
      expect(day.load.over).toBe(false)
    })
  })

  describe('capacity', () => {
    const three = [
      mine({ id: 'a', publish_date: TODAY }),
      mine({ id: 'b', publish_date: TODAY }),
      mine({ id: 'c', publish_date: TODAY }),
    ]

    it('flags being over the configured ceiling', () => {
      const day = buildMyDay(three, { today: TODAY, userId: ME, capacity: 2 })
      expect(day.load).toMatchObject({ count: 3, capacity: 2, over: true })
    })

    it('is not over when exactly at the ceiling', () => {
      const day = buildMyDay(three, { today: TODAY, userId: ME, capacity: 3 })
      expect(day.load.over).toBe(false)
    })

    it('never flags when no ceiling is configured', () => {
      const day = buildMyDay(three, { today: TODAY, userId: ME })
      expect(day.load).toMatchObject({ capacity: null, over: false })
    })

    // A ceiling of 0 means "nothing today" — it must not be read as "unset".
    it('honors a ceiling of zero', () => {
      const day = buildMyDay(three, { today: TODAY, userId: ME, capacity: 0 })
      expect(day.load.over).toBe(true)
    })
  })
})

describe('copy', () => {
  it('names the camera work when there is nothing to edit', () => {
    expect(myDayHeadline({ count: 0, capacity: null, over: false }, 150)).toBe(
      'Nada que editar hoy · 150 videos por grabar',
    )
    expect(myDayHeadline({ count: 0, capacity: null, over: false }, 1)).toMatch(/1 video por grabar/)
  })

  it('headlines the count in Spanish, singular and plural', () => {
    expect(myDayHeadline({ count: 0, capacity: null, over: false })).toMatch(/nada pendiente/i)
    expect(myDayHeadline({ count: 1, capacity: null, over: false })).toBe('Tienes 1 video hoy')
    expect(myDayHeadline({ count: 6, capacity: null, over: false })).toBe('Tienes 6 videos hoy')
  })

  it('says nothing about capacity when none is configured', () => {
    expect(myDayCapacityNote({ count: 3, capacity: null, over: false })).toBeNull()
  })

  it('says by how much you are over', () => {
    const note = myDayCapacityNote({ count: 6, capacity: 4, over: true })
    expect(note).toContain('4')
    expect(note).toContain('2 de más')
  })
})
