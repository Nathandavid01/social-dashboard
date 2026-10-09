import type { PublishedPost } from '@/app/api/metricool/posts/route'
export type CalendarPostState = 'draft' | 'scheduled' | 'published' | 'error' | 'unknown'
export function calendarPostState(post: Pick<PublishedPost, 'draft'> & { providerStatuses?: string[] }): CalendarPostState {
  if (post.draft) return 'draft'
  const statuses = post.providerStatuses ?? []
  if (statuses.some(s => s === 'ERROR')) return 'error'
  if (statuses.length && statuses.every(s => s === 'PUBLISHED')) return 'published'
  if (statuses.some(s => s === 'PENDING')) return 'scheduled'
  return 'unknown'
}
function wallTime(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(date)
  const value = (name: string) => parts.find(p => p.type === name)?.value
  return `${value('year')}-${value('month')}-${value('day')}T${value('hour')}:${value('minute')}:${value('second')}`
}
/** Metricool returns a wall time plus an IANA zone; calendar uses Puerto Rico. */
export function calendarPostDate(post: Pick<PublishedPost, 'publicationDate' | 'timezone'>): string {
  const raw = post.publicationDate
  try {
    let instant: Date
    if (/Z$|[+-]\d\d:\d\d$/.test(raw)) instant = new Date(raw)
    else {
      const target = new Date(`${raw}Z`).getTime()
      let guess = target
      for (let i = 0; i < 3; i++) {
        const observed = new Date(`${wallTime(new Date(guess), post.timezone || 'America/Puerto_Rico')}Z`).getTime()
        guess += target - observed
      }
      instant = new Date(guess)
    }
    return wallTime(instant, 'America/Puerto_Rico')
  } catch { return '' }
}
export function puertoRicoNow() { return wallTime(new Date(), 'America/Puerto_Rico') }
