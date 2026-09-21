import { addDaysISO } from '@/lib/utils/deadlines'
import { isRecordingSessionIncomplete } from '@/lib/utils/recording-confirmation'
import { requiredForOnsite } from './slot-count'

export type HoyGapMissing = 'cliente' | 'videografo' | 'hora'

export interface HoyGapSession {
  id: string
  title: string
  session_date: string
  status: string
  client_id: string | null
  videographer_id: string | null
  start_time: string | null
  client: { name: string | null; posting_days: number[] | null } | null
}

export interface HoyGapIdea {
  id: string
  client_id: string | null
  recording_session_id: string | null
  status: string
  title: string | null
}

export interface HoyGapItem {
  id: string
  title: string
  date: string
  missing?: HoyGapMissing[]
  ideaCount?: number
  slotTarget?: number
}

export interface RecordingHoyGaps {
  unconfirmed: HoyGapItem[]
  sinVideo: HoyGapItem[]
  ideasShortfall: HoyGapItem[]
  actionableCount: number
  actionableIds: string[]
}

export interface RecordingHoyGapsResult extends RecordingHoyGaps {
  visible: boolean
  error?: string
}

function isActive(status: string): boolean {
  return !['completed', 'cancelled'].includes(status)
}

function present(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

function sessionTitle(s: HoyGapSession): string {
  return (s.client?.name?.trim() || s.title || 'Grabación').trim()
}

function missingFields(s: HoyGapSession): HoyGapMissing[] {
  const missing: HoyGapMissing[] = []
  if (!present(s.client_id)) missing.push('cliente')
  if (!present(s.videographer_id)) missing.push('videografo')
  if (!present(s.start_time)) missing.push('hora')
  return missing
}

function ideaCountFor(session: HoyGapSession, ideas: HoyGapIdea[]): number {
  return new Set(
    ideas
      .filter((i) =>
        i.recording_session_id === session.id
        && i.client_id === session.client_id
        && i.status !== 'descartada'
        && i.title?.trim(),
      )
      .map((i) => i.id),
  ).size
}

function byDateThenId(a: HoyGapItem, b: HoyGapItem): number {
  return a.date.localeCompare(b.date) || a.id.localeCompare(b.id)
}

/** Unconfirmed + SIN VIDEO for Hoy cards and the Grabación nav badge. */
export function buildRecordingHoyGaps(
  sessions: HoyGapSession[],
  ideas: HoyGapIdea[],
  today: string,
): RecordingHoyGaps {
  const sinVideoUntil = addDaysISO(today, 7)
  const upcoming = sessions.filter((s) => isActive(s.status) && s.session_date >= today)

  const unconfirmed = upcoming
    .filter((s) => isRecordingSessionIncomplete(s))
    .map((s) => ({
      id: s.id,
      title: sessionTitle(s),
      date: s.session_date,
      missing: missingFields(s),
    }))
    .sort(byDateThenId)

  const sinVideo = upcoming
    .filter((s) => s.session_date <= sinVideoUntil && !present(s.videographer_id))
    .map((s) => ({
      id: s.id,
      title: sessionTitle(s),
      date: s.session_date,
    }))
    .sort(byDateThenId)

  const ideasShortfall = upcoming.flatMap((s) => {
    const slotTarget = requiredForOnsite({
      postingDays: s.client?.posting_days,
      ref: new Date(`${s.session_date}T12:00:00`),
    }).slotTarget
    if (!slotTarget) return []
    const count = ideaCountFor(s, ideas)
    if (count >= slotTarget) return []
    return [{
      id: s.id,
      title: sessionTitle(s),
      date: s.session_date,
      ideaCount: count,
      slotTarget,
    }]
  }).sort(byDateThenId)

  const actionableIds = [...new Set([...unconfirmed, ...sinVideo].map((s) => s.id))]
    .sort((a, b) => {
      const left = upcoming.find((s) => s.id === a)
      const right = upcoming.find((s) => s.id === b)
      return (left?.session_date ?? '').localeCompare(right?.session_date ?? '') || a.localeCompare(b)
    })

  return {
    unconfirmed,
    sinVideo,
    ideasShortfall,
    actionableCount: actionableIds.length,
    actionableIds,
  }
}

export function emptyRecordingHoyGaps(visible: boolean, error?: string): RecordingHoyGapsResult {
  return {
    visible,
    unconfirmed: [],
    sinVideo: [],
    ideasShortfall: [],
    actionableCount: 0,
    actionableIds: [],
    error,
  }
}
