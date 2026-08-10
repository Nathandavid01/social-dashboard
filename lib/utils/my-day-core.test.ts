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
import type { ContentIdeaVideo } from '@/lib/supabase/types'

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

/** A minimal uploaded edited file — only the fields the logic reads. */
const editedFile = () =>
  ({ id: 'f1', kind: 'edited', status: 'uploaded' }) as unknown as ContentIdeaVideo

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

  // An unshot video whose date has passed IS late — hiding that would lie in the
  // other direction. It's bucketed by date like everything else; what tells it
  // apart is its `kind`.
  it('is late when its date has passed, and marked as camera work', () => {
    const day = buildMyDay([slot('s1', '2026-07-01')], { today: TODAY, userId: ME })
    expect(day.atrasados).toHaveLength(1)
    expect(day.atrasados[0].kind).toBe('grabar')
  })

  it('says the next step is to SHOOT it, not to write a caption', () => {
    const day = buildMyDay([slot('s1', TODAY)], { today: TODAY, userId: ME })
    expect(day.hoy[0].nextStep.label).toMatch(/graba el video/i)
  })

  // The videographer's whole job is the camera — their load has to count it, or
  // their ceiling can never fire.
  it('counts toward the daily load, so a videographer can be over their ceiling', () => {
    const day = buildMyDay([slot('s1', TODAY), slot('s2', TODAY)], {
      today: TODAY,
      userId: ME,
      capacity: 1,
    })
    expect(day.load.count).toBe(2)
    expect(day.load.over).toBe(true)
  })
})

// The row for a video in review literally reads "aprueba o pide cambios". If I'm
// the one holding that button, it is MY work — filing it under "esperando" hid a
// supervisor's entire review queue and left it out of their count.
describe('a video waiting for review', () => {
  const inReview = (id: string) => mine({ id, approval_status: 'submitted', publish_date: TODAY })

  it('is MY work when I can approve', () => {
    const day = buildMyDay([inReview('a')], { today: TODAY, userId: ME, canApprove: true })
    expect(day.hoy).toHaveLength(1)
    expect(day.hoy[0].kind).toBe('aprobar')
    expect(day.load.count).toBe(1)
    expect(day.esperando).toHaveLength(0)
  })

  it("is someone else's when I cannot", () => {
    const day = buildMyDay([inReview('a')], { today: TODAY, userId: ME, canApprove: false })
    expect(day.esperando).toHaveLength(1)
    expect(day.esperando[0].kind).toBe('esperar')
    expect(day.load.count).toBe(0)
  })

  // Approving is a JOB, not a possession. If an editor owns the client, the
  // supervisor still has to approve it — leaving it off their day is how a review
  // queue goes unattended for a week.
  it("reaches the approver even when someone ELSE owns the video", () => {
    const theirs = video({
      id: 'theirs',
      approval_status: 'submitted',
      publish_date: TODAY,
      client: { id: 'c2', name: 'Otro', industry: null, assigned_to: OTHER },
    })
    const day = buildMyDay([mine({ id: 'own', publish_date: TODAY }), theirs], {
      today: TODAY,
      userId: ME,
      canApprove: true,
    })
    expect(day.scope).toBe('mio')
    expect(day.hoy.map((i) => i.video.id).sort()).toEqual(['own', 'theirs'])
    expect(day.hoy.find((i) => i.video.id === 'theirs')?.kind).toBe('aprobar')
  })
})

// An approved video that hasn't gone out yet is a POSTING job, not an editing one.
// Calling it "editar" mislabeled it and pinned it on editors who don't even have
// the publish button.
describe('an approved video that is not out yet', () => {
  const approved = (id: string) =>
    mine({
      id,
      approval_status: 'approved',
      generated_caption: 'c',
      publish_date: TODAY,
      videos: { raw: [], broll: [], edited: [editedFile()] },
    })

  it('is a publishing job for whoever holds the publish button', () => {
    const day = buildMyDay([approved('a')], { today: TODAY, userId: ME, canPublish: true })
    expect(day.hoy[0].kind).toBe('publicar')
    expect(day.load.count).toBe(1)
  })

  it("is not an editor's work — they can't publish it", () => {
    const day = buildMyDay([approved('a')], { today: TODAY, userId: ME, canPublish: false })
    expect(day.esperando).toHaveLength(1)
    expect(day.load.count).toBe(0)
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
  // Never claim the team pool is "yours".
  it('never says "tienes" about the team pool', () => {
    expect(myDayHeadline({ count: 3, capacity: null, over: false }, 'equipo')).toBe(
      'Hay 3 videos libres para hoy',
    )
    expect(myDayHeadline({ count: 0, capacity: null, over: false }, 'equipo')).toMatch(
      /no hay trabajo libre/i,
    )
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
