import { isAgendadoIdea, isPublishedIdea } from '@/lib/utils/client-pool-state'
import { addDaysISO } from '@/lib/utils/deadlines'
import { spanishDateLabel } from '@/lib/utils/next-autopost-core'
import { POSTING_TZ } from '@/lib/utils/publish-override'
import { resolveSlotTime } from '@/lib/utils/posting-schedule'
import { projectReciboVideos } from './calendar-projection'
import { isReciboGraphic } from './preview'
import type { IdeaWithPipeline } from '@/lib/supabase/types'

export const RECIBO_PUBLISH_TZ = POSTING_TZ

export type ReciboPublishSource = 'metricool' | 'publish_date' | 'proyeccion' | 'none'

export type ReciboDayCadence = {
  postingDays?: number[] | null
  postingTime?: string | null
  postingSchedule?: Record<string, string> | null
}

export type ReciboDayIdea = {
  id: string
  client_id: string
  status?: string | null
  publish_date?: string | null
  posted_at?: string | null
  published_at?: string | null
  metricool_post_id?: number | null
  manual_posted_status?: string | null
  created_at?: string | null
  videos?: Array<{
    id?: string
    kind?: string | null
    status?: string | null
    mime_type?: string | null
    name?: string | null
    storage_provider?: string | null
    drive_file_id?: string | null
    uploaded_at?: string | null
  }> | null
  client?: { name?: string | null } | null
}

export type ReciboPublishAt = {
  source: ReciboPublishSource
  dayISO: string | null
  timeHHMM: string | null
  sourceLabel: string
}

const SOURCE_LABEL: Record<ReciboPublishSource, string> = {
  metricool: 'Programado en Metricool',
  publish_date: 'Fecha prevista',
  proyeccion: 'Sugerida por cadencia',
  none: 'Sin fecha de publicación',
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/
const INSTANT = /^\d{4}-\d{2}-\d{2}T/

export function reciboDayPresets(todayISO: string): { today: string; tomorrow: string } {
  return { today: todayISO, tomorrow: addDaysISO(todayISO, 1) }
}

export function puertoRicoClock(value: string | null | undefined): { dayISO: string; timeHHMM: string } | null {
  const raw = value?.trim()
  if (!raw || DATE_ONLY.test(raw) || !INSTANT.test(raw)) return null
  const at = new Date(raw)
  if (!Number.isFinite(at.getTime())) return null
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: POSTING_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at)
  const get = (type: string) => parts.find((part) => part.type === type)?.value
  const dayISO = `${get('year')}-${get('month')}-${get('day')}`
  if (!DATE_ONLY.test(dayISO)) return null
  const hour = String(Number(get('hour') ?? '0') % 24).padStart(2, '0')
  const minute = String(Number(get('minute') ?? '0')).padStart(2, '0')
  return { dayISO, timeHHMM: `${hour}:${minute}` }
}

export function calendarDayFromValue(value: string | null | undefined): string | null {
  const raw = value?.trim()
  if (!raw) return null
  if (DATE_ONLY.test(raw)) return raw
  const prefix = raw.slice(0, 10)
  if (DATE_ONLY.test(prefix) && INSTANT.test(raw) && !/(Z|[+-]\d{2}:?\d{2})$/i.test(raw)) {
    return prefix
  }
  return puertoRicoClock(raw)?.dayISO ?? null
}

function weekdayOf(dateISO: string): number {
  return new Date(`${dateISO}T12:00:00Z`).getUTCDay()
}

function cadenceTime(dateISO: string, cadence: ReciboDayCadence | undefined): string | null {
  if (!cadence) return null
  return resolveSlotTime(weekdayOf(dateISO), cadence.postingTime, cadence.postingSchedule)
}

function clockLabel(time: string): string {
  const [hourText, minuteText] = time.split(':')
  const hour = Number(hourText)
  const minute = Number(minuteText)
  const hour12 = hour % 12 || 12
  return `${hour12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'a.m.' : 'p.m.'}`
}

function atFor(
  source: Exclude<ReciboPublishSource, 'none'>,
  dayISO: string,
  timeHHMM: string | null,
): ReciboPublishAt {
  return { source, dayISO, timeHHMM, sourceLabel: SOURCE_LABEL[source] }
}

const NONE: ReciboPublishAt = {
  source: 'none',
  dayISO: null,
  timeHHMM: null,
  sourceLabel: SOURCE_LABEL.none,
}

export function resolveReciboPublishAt(
  idea: ReciboDayIdea,
  cadence?: ReciboDayCadence,
  projectedDay?: string | null,
): ReciboPublishAt {
  const planned = calendarDayFromValue(idea.publish_date)
  const postedClock = puertoRicoClock(idea.posted_at)
  const scheduled = isAgendadoIdea(idea)

  if (scheduled && planned) {
    const time =
      postedClock && postedClock.dayISO === planned
        ? postedClock.timeHHMM
        : cadenceTime(planned, cadence)
    return atFor('metricool', planned, time)
  }

  if (planned) {
    return atFor('publish_date', planned, cadenceTime(planned, cadence))
  }

  const projected = projectedDay && DATE_ONLY.test(projectedDay) ? projectedDay : null
  if (projected) {
    return atFor('proyeccion', projected, cadenceTime(projected, cadence))
  }

  return NONE
}

export function formatReciboPublishAt(at: ReciboPublishAt): string {
  if (!at.dayISO) return SOURCE_LABEL.none
  const date = spanishDateLabel(at.dayISO)
  const sale = at.timeHHMM
    ? `Sale ${date}, ${clockLabel(at.timeHHMM)}`
    : `Sale ${date} · Sin hora`
  return `${sale} · ${at.sourceLabel}`
}

function occupiedDaysFrom(ideas: ReciboDayIdea[]): string[] {
  const days = new Set<string>()
  for (const idea of ideas) {
    if (!isPublishedIdea(idea) && !isAgendadoIdea(idea)) continue
    const day = calendarDayFromValue(idea.publish_date) ?? puertoRicoClock(idea.published_at ?? undefined)?.dayISO
    if (day) days.add(day)
  }
  return [...days]
}

export function projectedDaysByIdea(
  ideas: ReciboDayIdea[],
  cadenceByClient: Record<string, ReciboDayCadence>,
  todayISO: string,
  nowTime?: string,
): Map<string, string> {
  const byClient = new Map<string, ReciboDayIdea[]>()
  for (const idea of ideas) {
    const list = byClient.get(idea.client_id) ?? []
    list.push(idea)
    byClient.set(idea.client_id, list)
  }
  const projected = new Map<string, string>()
  for (const [clientId, clientIdeas] of byClient) {
    const cadence = cadenceByClient[clientId]
    const days = cadence?.postingDays ?? []
    if (!days.length) continue
    const dated = new Set(
      clientIdeas
        .map((idea) => calendarDayFromValue(idea.publish_date))
        .filter((day): day is string => Boolean(day)),
    )
    const occupied = [...new Set([...occupiedDaysFrom(clientIdeas), ...dated])]
    const pending = clientIdeas.filter((idea) => !calendarDayFromValue(idea.publish_date)) as IdeaWithPipeline[]
    const result = projectReciboVideos(
      pending,
      todayISO,
      days,
      occupied,
      cadence?.postingSchedule,
      cadence?.postingTime,
      nowTime,
    )
    for (const post of result.posts) projected.set(post.idea.id, post.date)
  }
  return projected
}

export function buildReciboPublishLookup(
  ideas: ReciboDayIdea[],
  cadenceByClient: Record<string, ReciboDayCadence>,
  todayISO: string,
  opts?: { occupancy?: ReciboDayIdea[]; nowTime?: string },
): Map<string, ReciboPublishAt> {
  const occupancy = opts?.occupancy ?? ideas
  const projected = projectedDaysByIdea(
    [...occupancy, ...ideas.filter((idea) => !occupancy.some((row) => row.id === idea.id))],
    cadenceByClient,
    todayISO,
    opts?.nowTime,
  )
  const lookup = new Map<string, ReciboPublishAt>()
  for (const idea of ideas) {
    lookup.set(
      idea.id,
      resolveReciboPublishAt(idea, cadenceByClient[idea.client_id], projected.get(idea.id) ?? null),
    )
  }
  return lookup
}

export function filterReciboIdeasByDay<T extends { id: string }>(
  ideas: T[],
  dayISO: string,
  lookup: Map<string, ReciboPublishAt>,
): T[] {
  if (!DATE_ONLY.test(dayISO)) return []
  return ideas.filter((idea) => lookup.get(idea.id)?.dayISO === dayISO)
}

export function sortReciboIdeasByPublishTime<T extends { id: string; client?: { name?: string | null } | null }>(
  ideas: T[],
  lookup: Map<string, ReciboPublishAt>,
): T[] {
  return [...ideas].sort((a, b) => {
    const left = lookup.get(a.id)
    const right = lookup.get(b.id)
    const leftTime = left?.timeHHMM ?? '99:99'
    const rightTime = right?.timeHHMM ?? '99:99'
    if (leftTime !== rightTime) return leftTime.localeCompare(rightTime)
    const names = (a.client?.name ?? '').localeCompare(b.client?.name ?? '', 'es')
    if (names) return names
    return a.id.localeCompare(b.id)
  })
}

export function reciboVideosForDay<T extends ReciboDayIdea>(
  ideas: T[],
  dayISO: string,
  lookup: Map<string, ReciboPublishAt>,
): T[] {
  const videos = ideas.filter((idea) => !isReciboGraphic({ videos: (idea.videos ?? []) as IdeaWithPipeline['videos'] }))
  return sortReciboIdeasByPublishTime(filterReciboIdeasByDay(videos, dayISO, lookup), lookup)
}
