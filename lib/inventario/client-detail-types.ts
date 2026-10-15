import type { CalendarDay, DetailPost } from './client-detail-core'
import type { Format } from './cadence-formats'

/** What the profile panel and the 3D calendar get when a client is selected. */
export interface ClientStockDetail {
  profile: {
    id: string
    name: string
    logoUrl: string | null
    /** JS weekdays 0=Sun..6=Sat. */
    postingDays: number[]
    postingTime: string | null
    editorName: string | null
    /** JS weekday → format that day takes (null = either). */
    formats: Partial<Record<number, Format | null>>
  }
  calendar: CalendarDay[]
  upcoming: (DetailPost & { coverUrl: string | null })[]
  recent: (DetailPost & { coverUrl: string | null })[]
  crudo: number
}
