import {
  isAgendadoIdea,
  isClientApproved,
  isPublishedIdea,
  weekCadenceDates,
  type PoolStateInput,
} from '@/lib/utils/client-pool-state'
import { POSTING_TZ } from '@/lib/utils/publish-override'
import {
  hasReciboUploaderCut,
  RECIBO_HELD_CLIENT_IDS,
  RECIBO_MANUAL_IDEA_IDS,
  type ReciboQueueIdea,
} from './board-ideas'

const USABLE_KINDS = new Set(['edited', 'raw', 'broll'])

export type ReciboSpaceVideo = {
  id?: string
  kind?: string | null
  status?: string | null
  uploaded_at?: string | null
  uploaded_by?: string | null
}

export type ReciboSpaceIdea = ReciboQueueIdea & {
  publish_date?: string | null
  created_at?: string | null
  submitted_at?: string | null
  videos?: ReciboSpaceVideo[] | null
}

export type ReciboSpaceTone = 'approved' | 'pending' | 'scheduled'

export type ReciboCadenceSpace<T extends ReciboSpaceIdea = ReciboSpaceIdea> =
  | { kind: 'occupied'; key: string; idea: T; tone: ReciboSpaceTone; dateISO?: string }
  | { kind: 'empty'; key: string; dateISO?: string; label: 'Pendiente' }

export type ReciboMonthCount = {
  key: string
  label: string
  count: number
  current: boolean
}

export function usableUpload(video: ReciboSpaceVideo): boolean {
  return USABLE_KINDS.has(video.kind ?? '') && video.status !== 'archived' && video.status !== 'failed'
}

export function occupyingVideo<T extends ReciboSpaceVideo>(
  idea: { videos?: T[] | null },
): T | null {
  const usable = (idea.videos ?? []).filter(usableUpload)
  if (usable.length === 0) return null
  const edited = usable.filter((video) => video.kind === 'edited')
  const pool = edited.length > 0 ? edited : usable
  return [...pool].sort((a, b) => (b.uploaded_at ?? '').localeCompare(a.uploaded_at ?? ''))[0] ?? null
}

function hasUsableUpload(idea: ReciboSpaceIdea): boolean {
  return occupyingVideo(idea) != null
}

function inReciboScope(idea: ReciboSpaceIdea, aiClientIds: Set<string>): boolean {
  if (idea.client?.status && idea.client.status !== 'active') return false
  if (idea.status === 'descartada') return false
  if (RECIBO_HELD_CLIENT_IDS.has(idea.client_id) && !RECIBO_MANUAL_IDEA_IDS.has(idea.id)) return false
  // Human clients: only Eric or Nathan's edited cut. Raw stays in On Site → Revisión.
  return aiClientIds.has(idea.client_id) || hasReciboUploaderCut(idea)
}

/** Videos that can fill a Recibo space or a monthly count. Includes published. */
export function reciboOccupancyIdeas<T extends ReciboSpaceIdea>(
  ideas: T[],
  aiClientIds: Iterable<string>,
): T[] {
  const ids = new Set(aiClientIds)
  return ideas.filter((idea) => inReciboScope(idea, ids) && hasUsableUpload(idea))
}

/** Held clients stay off Recibo, including empty cadence columns. */
export function reciboVisibleAiClients<T extends { id: string }>(clients: T[]): T[] {
  return clients.filter((client) => !RECIBO_HELD_CLIENT_IDS.has(client.id))
}

/** First row per idea wins — caller must order decided_at desc. */
export function reviewStatusByIdea(
  rows: Array<{ idea_id?: string | null; status?: string | null }>,
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const row of rows) {
    if (!row.idea_id || row.idea_id in out || !row.status) continue
    out[row.idea_id] = row.status
  }
  return out
}

/** `/aprobacion` votes live on entregas_client_review_items, not content_ideas. */
export function applyEntregasReviewStatus<T extends ReciboSpaceIdea>(
  ideas: T[],
  reviewByIdea: Record<string, string>,
): T[] {
  return ideas.map((idea) => ({
    ...idea,
    entregas_review_status: idea.entregas_review_status ?? reviewByIdea[idea.id] ?? null,
  }))
}

export function reciboSpaceTone(idea: PoolStateInput): ReciboSpaceTone {
  if (isPublishedIdea(idea)) return 'approved'
  if (isAgendadoIdea(idea)) return 'scheduled'
  if (isClientApproved(idea)) return 'approved'
  return 'pending'
}

function dateInWeek(iso: string | null | undefined, week: { desde: string; hasta: string }): boolean {
  if (!iso) return false
  const day = iso.slice(0, 10)
  return day >= week.desde && day <= week.hasta
}

function publishedThisWeek(idea: ReciboSpaceIdea, week: { desde: string; hasta: string }): boolean {
  if (!isPublishedIdea(idea) && !isAgendadoIdea(idea)) return false
  return (
    dateInWeek(idea.published_at, week)
    || dateInWeek(idea.posted_at, week)
    || dateInWeek(idea.publish_date, week)
  )
}

function stillOnQueue(idea: ReciboSpaceIdea): boolean {
  return !isPublishedIdea(idea) && !isAgendadoIdea(idea)
}

function scheduledOnBoard(idea: ReciboSpaceIdea): boolean {
  return isAgendadoIdea(idea) && !isPublishedIdea(idea) && hasUsableUpload(idea)
}

function occupiedSpace<T extends ReciboSpaceIdea>(idea: T, dateISO?: string): ReciboCadenceSpace<T> {
  return {
    kind: 'occupied',
    key: `idea-${idea.id}`,
    idea,
    tone: reciboSpaceTone(idea),
    dateISO,
  }
}

export function buildReciboCadenceSpaces<T extends ReciboSpaceIdea>(input: {
  postingDays?: number[] | null
  ideas: T[]
  occupancyIdeas?: T[]
  week: { desde: string; hasta: string }
  /** Empty cadence padding is only for AI clients. Eric or Nathan cuts on a human client stay as cards. */
  padEmpty?: boolean
}): ReciboCadenceSpace<T>[] {
  const occupancy = input.occupancyIdeas ?? input.ideas
  const queue = input.ideas.filter((idea) => stillOnQueue(idea) && hasUsableUpload(idea))
  const scheduledById = new Map<string, T>()
  for (const idea of [...occupancy, ...input.ideas]) {
    if (scheduledOnBoard(idea) && !scheduledById.has(idea.id)) scheduledById.set(idea.id, idea)
  }
  const scheduled = [...scheduledById.values()]
  const liveCupo = occupancy.filter((idea) => isPublishedIdea(idea) && publishedThisWeek(idea, input.week)).length
  const dates = input.padEmpty === false ? [] : weekCadenceDates(input.postingDays, input.week)

  if (dates.length === 0) {
    return [...scheduled, ...queue].map((idea) => occupiedSpace(idea, idea.publish_date?.slice(0, 10)))
  }

  const pinned = new Map<string, T>()
  const overflowScheduled: T[] = []
  for (const idea of scheduled) {
    const date = idea.publish_date?.slice(0, 10)
    if (date && dates.includes(date) && !pinned.has(date)) pinned.set(date, idea)
    else overflowScheduled.push(idea)
  }

  const leftoverQueue = [...queue]
  const spaces: ReciboCadenceSpace<T>[] = []
  let skipEmpties = liveCupo

  for (const dateISO of dates) {
    const pinnedIdea = pinned.get(dateISO)
    if (pinnedIdea) {
      spaces.push(occupiedSpace(pinnedIdea, dateISO))
      continue
    }
    const next = leftoverQueue.shift()
    if (next) {
      spaces.push(occupiedSpace(next, dateISO))
      continue
    }
    if (skipEmpties > 0) {
      skipEmpties -= 1
      continue
    }
    spaces.push({
      kind: 'empty',
      key: `empty-${dateISO}`,
      dateISO,
      label: 'Pendiente',
    })
  }

  for (const idea of leftoverQueue) spaces.push(occupiedSpace(idea))
  for (const idea of overflowScheduled) spaces.push(occupiedSpace(idea, idea.publish_date?.slice(0, 10)))
  return spaces
}

function monthKeyFromInstant(iso: string, timeZone = POSTING_TZ): string | null {
  const at = new Date(iso)
  if (!Number.isFinite(at.getTime())) return null
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit' }).formatToParts(at)
  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  if (!year || !month) return null
  return `${year}-${month}`
}

function monthLabelEs(key: string): string {
  const [year, month] = key.split('-').map(Number)
  if (!year || !month) return key
  return new Intl.DateTimeFormat('es-PR', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1))
}

function uploadMonthKey(idea: ReciboSpaceIdea, timeZone = POSTING_TZ): string | null {
  const video = occupyingVideo(idea)
  const iso = video?.uploaded_at || idea.submitted_at || idea.created_at
  if (!iso) return null
  return monthKeyFromInstant(iso, timeZone)
}

export function reciboMonthlyUploadCounts(
  ideas: ReciboSpaceIdea[],
  todayISO: string,
  timeZone = POSTING_TZ,
): { total: number; months: ReciboMonthCount[] } {
  const currentKey = monthKeyFromInstant(`${todayISO}T12:00:00`, timeZone) ?? todayISO.slice(0, 7)
  const counts = new Map<string, number>()
  let total = 0
  for (const idea of ideas) {
    if (!hasUsableUpload(idea)) continue
    const key = uploadMonthKey(idea, timeZone)
    if (!key) continue
    counts.set(key, (counts.get(key) ?? 0) + 1)
    total += 1
  }

  const months: ReciboMonthCount[] = [{
    key: currentKey,
    label: monthLabelEs(currentKey),
    count: counts.get(currentKey) ?? 0,
    current: true,
  }]
  const previous = [...counts.keys()]
    .filter((key) => key !== currentKey)
    .sort((a, b) => b.localeCompare(a))
  for (const key of previous) {
    months.push({
      key,
      label: monthLabelEs(key),
      count: counts.get(key) ?? 0,
      current: false,
    })
  }
  return { total, months }
}
