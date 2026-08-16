import { buildPublishDateTime } from '@/lib/utils/idea-posting-core'
import { nextPostingDates } from '@/lib/utils/planned-sessions'
import { resolveSlotTime } from '@/lib/utils/posting-schedule'
import { humanJoinEs } from '@/lib/utils/next-autopost-core'
import { formatLabel, isValidFormat, PLATFORM_FORMATS } from '@/lib/utils/platform-formats'
import { platformLabels } from '@/lib/utils'
import type { SocialPlatform } from '@/lib/supabase/types'

const MONTH_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'] as const
const WEEKDAY_SHORT_ES = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'] as const

export interface ClientCadence {
  postingTime?: string | null
  postingDays?: number[]
  metricoolBlogId?: string | null
}

export interface PublishSlotInfo {
  title: string | null
  whenLabel: string
  inMetricool: boolean
  /** True when the date comes from cadence (no video row yet). */
  isCadenceSlot?: boolean
}

export interface SchedulableVideo {
  id: string
  title?: string | null
  hook?: string | null
  publish_date?: string | null
  metricool_post_id?: number | null
  published_at?: string | null
  status?: string | null
}

function isPublished(v: SchedulableVideo): boolean {
  return !!v.published_at || v.status === 'publicada'
}

function videoTitle(v: SchedulableVideo): string {
  const t = v.title?.trim() || v.hook?.trim()
  return t || 'Sin título'
}

/** Human-readable schedule from publish_date + client posting_time. */
export function formatScheduledPublish(
  publishDate: string | null | undefined,
  postingTime: string | null | undefined,
  nowMs: number = Date.now(),
): string | null {
  if (!publishDate) return null
  const iso = buildPublishDateTime(publishDate, postingTime, nowMs)
  const [datePart, timePart] = iso.split('T')
  const [y, m, d] = datePart.split('-').map(Number)
  if (!y || !m || !d) return publishDate
  const time = timePart?.slice(0, 5) ?? '10:00'
  return `${d} ${MONTH_ES[m - 1]} ${y} · ${time}`
}

/**
 * The next unpublished video with a future (or today) publish_date, or the
 * earliest Metricool-scheduled video if none have dates.
 */
export function findNextQueuePublish(
  videos: SchedulableVideo[],
  cadence: ClientCadence,
  nowMs: number = Date.now(),
): PublishSlotInfo | null {
  const today = new Date(nowMs).toISOString().slice(0, 10)
  const pending = videos.filter((v) => !isPublished(v))

  const dated = pending
    .filter((v) => v.publish_date)
    .sort((a, b) => (a.publish_date! < b.publish_date! ? -1 : 1))

  const upcoming = dated.filter((v) => v.publish_date! >= today)
  const pick = upcoming[0] ?? dated[0]
  if (pick?.publish_date) {
    const whenLabel = formatScheduledPublish(pick.publish_date, cadence.postingTime, nowMs)
    if (whenLabel) {
      return {
        title: videoTitle(pick),
        whenLabel,
        inMetricool: pick.metricool_post_id != null,
      }
    }
  }

  const inMetricool = pending.find((v) => v.metricool_post_id != null)
  if (inMetricool) {
    return {
      title: videoTitle(inMetricool),
      whenLabel: inMetricool.publish_date
        ? (formatScheduledPublish(inMetricool.publish_date, cadence.postingTime, nowMs) ?? 'Programado en Metricool')
        : 'Programado en Metricool',
      inMetricool: true,
    }
  }

  return null
}

/** Next cadence slot for a newly added video (after existing active videos). */
export function findNextNewVideoSlot(
  activeCount: number,
  cadence: ClientCadence,
  nowMs: number = Date.now(),
): PublishSlotInfo | null {
  const days = cadence.postingDays ?? []
  if (days.length === 0) return null
  const slots = nextPostingDates(days, activeCount + 1, new Date(nowMs))
  const nextDate = slots[activeCount]
  if (!nextDate) return null
  const whenLabel = formatScheduledPublish(nextDate, cadence.postingTime, nowMs)
  if (!whenLabel) return null
  return { title: null, whenLabel, inMetricool: false, isCadenceSlot: true }
}

export function countMetricoolScheduled(videos: SchedulableVideo[]): number {
  return videos.filter((v) => !isPublished(v) && v.metricool_post_id != null).length
}

/** "15:20" → "3:20 p. m." (no Intl dependency, matches the app's other 12h labels). */
function to12h(hhmm: string): string | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm)
  if (!m) return null
  const h24 = Math.min(23, Math.max(0, parseInt(m[1], 10)))
  const period = h24 >= 12 ? 'p. m.' : 'a. m.'
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h12}:${m[2]} ${period}`
}

/**
 * The Metricool format per resolved network, grouped: same format across
 * several networks reads as ONE phrase ("Reel en Instagram y Facebook"); a
 * different format per network reads as separate phrases joined by commas
 * ("Reel en Instagram, Imagen en Facebook").
 *
 * `platformFormats` is content_ideas.platform_formats — the actual value that
 * will be sent to Metricool. When a network has no explicit entry there (older
 * ideas, or not yet chosen), `fallbackFormatLabel` (the video's content_type
 * label, e.g. "Reel") is used instead — never a guessed platform-specific code.
 */
function describePublishFormats(
  platforms: string[],
  platformFormats: Record<string, string> | null | undefined,
  fallbackFormatLabel: string | null,
): string | null {
  const groups = new Map<string, string[]>()
  for (const raw of platforms) {
    const p = raw.toLowerCase() as SocialPlatform
    if (!PLATFORM_FORMATS[p]) continue
    const code = platformFormats?.[raw] ?? platformFormats?.[p]
    const label = code && isValidFormat(p, code) ? formatLabel(p, code) : fallbackFormatLabel
    if (!label) continue
    const display = platformLabels[p] ?? raw
    const list = groups.get(label) ?? []
    list.push(display)
    groups.set(label, list)
  }
  if (groups.size === 0) return null
  return Array.from(groups.entries())
    .map(([label, plats]) => `${label} en ${humanJoinEs(plats)}`)
    .join(', ')
}

export interface VideoAgendaLine {
  /** False when there's no publish_date at all — nothing else is computed then. */
  hasDate: boolean
  /** "lun 17 ago", local (no year — this is a near-term glance, not an archive label). */
  dateLabel: string | null
  /** True when publish_date is strictly before today. */
  pastDue: boolean
  /** False when neither posting_schedule nor posting_time has a value for that day. */
  timeConfigured: boolean
  /** "3:20 p. m." or null when timeConfigured is false. */
  timeLabel: string | null
  /** "Reel en Instagram y Facebook", or null with no resolved platforms. */
  formatsLabel: string | null
}

/**
 * One glance-line for a batch video card: when it publishes, at what time, and
 * in what format(s) — everything Metricool will receive once the video is
 * approved. Pure — the card passes already-resolved data (client posting_time /
 * posting_schedule / resolved platforms), never fetches on its own.
 */
export function buildVideoAgendaLine(params: {
  publishDate: string | null | undefined
  postingTime?: string | null
  postingSchedule?: Record<string, string> | null
  platforms: string[]
  platformFormats?: Record<string, string> | null
  fallbackFormatLabel: string | null
  nowMs?: number
}): VideoAgendaLine {
  const nowMs = params.nowMs ?? Date.now()
  const formatsLabel = describePublishFormats(params.platforms, params.platformFormats, params.fallbackFormatLabel)

  if (!params.publishDate) {
    return { hasDate: false, dateLabel: null, pastDue: false, timeConfigured: false, timeLabel: null, formatsLabel: null }
  }

  const [y, m, d] = params.publishDate.split('-').map(Number)
  const valid = !!y && !!m && !!d
  const local = valid ? new Date(y, m - 1, d) : null
  const dateLabel = local ? `${WEEKDAY_SHORT_ES[local.getDay()]} ${d} ${MONTH_ES[m - 1]}` : params.publishDate

  const todayUtc = new Date(nowMs).toISOString().slice(0, 10)
  const pastDue = params.publishDate < todayUtc

  const effectiveTime = local ? resolveSlotTime(local.getDay(), params.postingTime, params.postingSchedule) : null
  const timeLabel = effectiveTime ? to12h(effectiveTime) : null

  return {
    hasDate: true,
    dateLabel,
    pastDue,
    timeConfigured: !!timeLabel,
    timeLabel,
    formatsLabel,
  }
}
