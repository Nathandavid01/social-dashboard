/**
 * Per-client posting cadence — the single source of truth.
 *
 * Stored on `clients`: posting_days, posting_time, posting_schedule, posting_timezone.
 * Frequency is the count of selected days. Nothing here invents a day, time, or
 * timezone a person did not set. The agency zone is only a clock fallback for
 * overdue math; it is never written back.
 */
import { dayLabelsShort } from './posting-cadence'
import { computeScheduleSlots, resolveSlotTime } from './posting-schedule'

export const AGENCY_TIMEZONE = 'America/Puerto_Rico'

export const CADENCE_TIMEZONES = [
  { id: 'America/Puerto_Rico', label: 'Puerto Rico (AST)' },
  { id: 'America/New_York', label: 'Nueva York (ET)' },
  { id: 'America/Chicago', label: 'Chicago (CT)' },
  { id: 'America/Denver', label: 'Denver (MT)' },
  { id: 'America/Los_Angeles', label: 'Los Ángeles (PT)' },
  { id: 'America/Santo_Domingo', label: 'Santo Domingo (AST)' },
  { id: 'America/Mexico_City', label: 'Ciudad de México (CT)' },
  { id: 'UTC', label: 'UTC' },
] as const

export type CadenceTimezoneId = (typeof CADENCE_TIMEZONES)[number]['id']

const TZ_IDS = new Set<string>(CADENCE_TIMEZONES.map((z) => z.id))
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

export interface ClientCadenceSource {
  posting_days?: number[] | null
  posting_time?: string | null
  posting_schedule?: Record<string, string> | null
  posting_timezone?: string | null
}

export interface ClientPostingCadence {
  postingDays: number[]
  postingTime: string | null
  postingSchedule: Record<string, string>
  timezone: string | null
  postsPerWeek: number
}

export function isCadenceTimezone(value: string | null | undefined): value is CadenceTimezoneId {
  return !!value && TZ_IDS.has(value)
}

export function cleanPostingDays(days: number[] | null | undefined): number[] {
  return Array.from(new Set((days ?? []).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))).sort((a, b) => a - b)
}

export function cleanPostingTime(time: string | null | undefined): string | null {
  if (!time || !TIME_RE.test(time.trim())) return null
  return time.trim()
}

export function cleanPostingSchedule(
  schedule: Record<string, string> | null | undefined,
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, raw] of Object.entries(schedule ?? {})) {
    if (!/^[0-6]$/.test(key)) continue
    const time = cleanPostingTime(raw)
    if (time) out[key] = time
  }
  return out
}

export function cleanTimezone(tz: string | null | undefined): string | null {
  if (!tz || !tz.trim()) return null
  return isCadenceTimezone(tz.trim()) ? tz.trim() : null
}

export function readClientCadence(source: ClientCadenceSource): ClientPostingCadence {
  const postingDays = cleanPostingDays(source.posting_days)
  return {
    postingDays,
    postingTime: cleanPostingTime(source.posting_time),
    postingSchedule: cleanPostingSchedule(source.posting_schedule),
    timezone: cleanTimezone(source.posting_timezone),
    postsPerWeek: postingDays.length,
  }
}

/** Clock fallback only — never persist this unless a person picked the zone. */
export function effectiveTimezone(cadence: { timezone: string | null }): string {
  return cadence.timezone ?? AGENCY_TIMEZONE
}

export function cadenceTimeForWeekday(cadence: ClientPostingCadence, jsWeekday: number): string | null {
  if (!cadence.postingDays.includes(jsWeekday)) return null
  return resolveSlotTime(jsWeekday, cadence.postingTime, cadence.postingSchedule)
}

export function formatCadenceDaysEs(days: number[]): string {
  return cleanPostingDays(days)
    .map((d) => dayLabelsShort[d])
    .join(' · ')
}

export function formatCadenceSummaryEs(cadence: ClientPostingCadence): string {
  if (cadence.postingDays.length === 0) return 'Sin cadencia'
  const parts = [`${cadence.postsPerWeek}/sem`, formatCadenceDaysEs(cadence.postingDays)]
  if (cadence.postingTime) parts.push(cadence.postingTime)
  const zone = CADENCE_TIMEZONES.find((z) => z.id === cadence.timezone)
  if (zone) parts.push(zone.label.replace(/ \(.+\)$/, ''))
  return parts.join(' · ')
}

export function minutesSinceMidnightInTz(timeZone: string, now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(now)
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0) % 24
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0)
  return hour * 60 + minute
}

export function cadenceRevalidatePaths(clientId: string): string[] {
  return [
    `/clients/${clientId}`,
    '/clients',
    '/pipeline',
    '/home',
    '/planning',
    '/calendar',
    '/produccion',
    '/posting',
    '/banco',
    '/mi-dia',
    '/runway',
    '/operations',
  ]
}

export function isMissingTimezoneColumn(error: { message?: string } | null | undefined): boolean {
  return /posting_timezone/i.test(error?.message ?? '')
}

export interface CadenceCalendarClient extends ClientCadenceSource {
  id: string
  name: string
}

export interface CadenceCalendarItem {
  id: string
  type: 'cadencia'
  date: string
  title: string
  clientId: string
  clientName: string
  assignee: null
  href: string
}

/** Expected posting slots for the calendar — only days a person configured. */
export function cadenceCalendarItems(
  clients: CadenceCalendarClient[],
  rangeStart: Date,
  rangeEnd: Date,
): CadenceCalendarItem[] {
  const items: CadenceCalendarItem[] = []
  for (const client of clients) {
    const cadence = readClientCadence(client)
    if (cadence.postingDays.length === 0) continue
    const slots = computeScheduleSlots({
      postingDays: cadence.postingDays,
      postingTime: cadence.postingTime,
      postingSchedule: cadence.postingSchedule,
      rangeStart,
      rangeEnd,
      postedDates: [],
      ref: rangeStart,
    })
    for (const slot of slots) {
      const time = slot.time
      items.push({
        id: `cadencia:${client.id}:${slot.date}`,
        type: 'cadencia',
        date: `${slot.date}T${time ?? '12:00'}:00`,
        title: time ? `Cadencia · ${time}` : 'Cadencia',
        clientId: client.id,
        clientName: client.name,
        assignee: null,
        href: `/clients/${client.id}?tab=schedule`,
      })
    }
  }
  return items
}

export function pipelineCadenceFromClient(c: ClientCadenceSource & { metricool_blog_id?: string | null }) {
  const cadence = readClientCadence(c)
  return {
    postingDays: cadence.postingDays,
    postingTime: cadence.postingTime,
    postingSchedule: cadence.postingSchedule,
    timezone: cadence.timezone,
    metricoolBlogId: c.metricool_blog_id ?? null,
  }
}

export function pruneScheduleToDays(
  schedule: Record<string, string>,
  postingDays: number[],
): Record<string, string> {
  const keep = new Set(postingDays.map(String))
  const out: Record<string, string> = {}
  for (const [day, time] of Object.entries(schedule)) {
    if (keep.has(day)) out[day] = time
  }
  return out
}
