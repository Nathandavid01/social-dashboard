import { describe, it, expect } from 'vitest'
import {
  buildVideographerHistory,
  formatSessionDate,
  videographerHistorySummary,
  type HistoryIdeaInput,
  type HistoryVideoInput,
} from './videographer-history'

const VID = 'vid-1'

function idea(partial: Partial<HistoryIdeaInput> & Pick<HistoryIdeaInput, 'id'>): HistoryIdeaInput {
  return {
    title: 'Idea',
    createdBy: 'sup',
    createdAt: '2026-09-01T12:00:00.000Z',
    recordingSessionId: 's1',
    clientName: 'Nana',
    sessionTitle: 'Mañana en el parque',
    sessionDate: '2026-09-12',
    ...partial,
  }
}

function video(partial: Partial<HistoryVideoInput> & Pick<HistoryVideoInput, 'id' | 'ideaId'>): HistoryVideoInput {
  return {
    name: 'toma.mp4',
    kind: 'raw',
    status: 'uploaded',
    uploadedBy: VID,
    uploadedAt: '2026-09-12T15:00:00.000Z',
    ...partial,
  }
}

describe('buildVideographerHistory', () => {
  it('groups that person\'s videos under each idea and ignores everyone else', () => {
    const sessions = buildVideographerHistory(VID, [
      video({ id: 'v1', ideaId: 'i1', name: 'primera.mp4', uploadedAt: '2026-09-12T15:00:00.000Z' }),
      video({ id: 'v2', ideaId: 'i1', name: 'segunda.mp4', uploadedAt: '2026-09-12T16:00:00.000Z' }),
      video({ id: 'other', ideaId: 'i1', uploadedBy: 'otra', name: 'ajeno.mp4' }),
      video({ id: 'gone', ideaId: 'i1', status: 'archived', name: 'archivado.mp4' }),
    ], [idea({ id: 'i1', title: 'Hook del mes' })])

    expect(sessions).toHaveLength(1)
    expect(sessions[0].ideas).toHaveLength(1)
    expect(sessions[0].ideas[0].title).toBe('Hook del mes')
    expect(sessions[0].ideas[0].additional).toBe(false)
    expect(sessions[0].ideas[0].videos.map((v) => v.name)).toEqual(['segunda.mp4', 'primera.mp4'])
  })

  it('marks an idea created by the recorder during the session as additional, even with no video yet', () => {
    const sessions = buildVideographerHistory(VID, [], [
      idea({ id: 'extra', title: 'DJI_0991', createdBy: VID, createdAt: '2026-09-12T18:00:00.000Z' }),
    ])

    expect(sessions[0].ideas[0]).toMatchObject({ title: 'DJI_0991', additional: true, videos: [] })
  })

  it('does not call an idea additional when they created it outside a recording session', () => {
    const sessions = buildVideographerHistory(VID, [
      video({ id: 'v1', ideaId: 'suelta' }),
    ], [
      idea({
        id: 'suelta',
        title: 'Suelta',
        createdBy: VID,
        recordingSessionId: null,
        sessionTitle: null,
        sessionDate: null,
      }),
    ])

    expect(sessions[0].sessionId).toBeNull()
    expect(sessions[0].ideas[0].additional).toBe(false)
    expect(sessions[0].ideas[0].videos).toHaveLength(1)
  })

  it('keeps a video whose idea row is missing', () => {
    const sessions = buildVideographerHistory(VID, [
      video({ id: 'v1', ideaId: 'missing', name: 'huerfano.mp4' }),
    ], [])

    expect(sessions[0].ideas[0]).toMatchObject({
      ideaId: 'missing',
      title: 'Sin título',
      additional: false,
    })
    expect(sessions[0].ideas[0].videos[0].name).toBe('huerfano.mp4')
  })

  it('orders sessions newest first and planned ideas before additional ones', () => {
    const sessions = buildVideographerHistory(VID, [
      video({ id: 'old', ideaId: 'old-idea', uploadedAt: '2026-08-01T12:00:00.000Z' }),
      video({ id: 'new', ideaId: 'new-idea', uploadedAt: '2026-09-12T12:00:00.000Z' }),
      video({ id: 'add', ideaId: 'add-idea', uploadedAt: '2026-09-12T13:00:00.000Z' }),
    ], [
      idea({ id: 'old-idea', recordingSessionId: 'old', sessionDate: '2026-08-01', sessionTitle: 'Agosto', clientName: 'A' }),
      idea({ id: 'new-idea', recordingSessionId: 'new', sessionDate: '2026-09-12', sessionTitle: 'Septiembre', clientName: 'B' }),
      idea({ id: 'add-idea', title: 'Extra', createdBy: VID, recordingSessionId: 'new', sessionDate: '2026-09-12', sessionTitle: 'Septiembre', clientName: 'B' }),
    ])

    expect(sessions.map((s) => s.sessionDate)).toEqual(['2026-09-12', '2026-08-01'])
    expect(sessions[0].ideas.map((i) => i.additional)).toEqual([false, true])
  })

  it('returns nothing when the person has neither videos nor extra ideas', () => {
    expect(buildVideographerHistory(VID, [
      video({ id: 'x', ideaId: 'i', uploadedBy: 'otra' }),
    ], [idea({ id: 'i' })])).toEqual([])
  })
})

describe('videographerHistorySummary', () => {
  it('counts videos, ideas and additional ideas', () => {
    const sessions = buildVideographerHistory(VID, [
      video({ id: 'v1', ideaId: 'i1' }),
      video({ id: 'v2', ideaId: 'extra' }),
    ], [
      idea({ id: 'i1' }),
      idea({ id: 'extra', createdBy: VID }),
    ])
    expect(videographerHistorySummary(sessions)).toEqual({ videos: 2, ideas: 2, additional: 1 })
  })
})

describe('formatSessionDate', () => {
  it('formats a session date without shifting the calendar day', () => {
    expect(formatSessionDate('2026-09-12')).toMatch(/12/)
    expect(formatSessionDate('2026-09-12')?.toLowerCase()).toMatch(/sept/)
    expect(formatSessionDate(null)).toBeNull()
    expect(formatSessionDate('no-es-fecha')).toBeNull()
  })
})
