import { buildPublishDateTime } from '@/lib/utils/idea-posting-core'
import { nextPostingDates } from '@/lib/utils/planned-sessions'

const MONTH_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'] as const

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
