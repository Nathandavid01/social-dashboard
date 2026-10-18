/**
 * Posts sitting in the Metricool planner — including ones made by hand that the
 * dashboard never saw. A pending, non-draft post with a date today or later
 * covers that posting day. Pure: the loader fetches, this decides.
 */
import { publicationDay } from '@/lib/metricool/publication-date'
import type { ScheduledPost } from '@/lib/metricool/scheduler'
import type { Format } from './cadence-formats'

export interface ScheduledSlot {
  /** Metricool post id. */
  id: number
  /** Puerto Rico day it goes out ("YYYY-MM-DD"). */
  date: string
  format: Format
  title: string
}

type PlannerPost = ScheduledPost & {
  instagramData?: { type?: string } | null
  facebookData?: { type?: string } | null
}

function isReel(p: PlannerPost): boolean {
  if (p.instagramData?.type === 'REEL' || p.facebookData?.type === 'REEL') return true
  return (p.media ?? []).some((m) => typeof m === 'string' && /\.(mp4|mov|m4v|webm)(\?|$)/i.test(m))
}

export function toScheduledSlot(post: ScheduledPost, today: string): ScheduledSlot | null {
  const p = post as PlannerPost
  if (p.draft) return null
  const providers = p.providers ?? []
  if (providers.length === 0) return null
  // Already out (published) or broken (error): not something still waiting.
  if (providers.every((x) => x.status === 'PUBLISHED')) return null
  if (providers.some((x) => x.status === 'ERROR')) return null
  const date = publicationDay(p.publicationDate)
  if (!date || date < today) return null
  const title = (p.text ?? '').split('\n')[0].trim() || 'Post agendado en Metricool'
  return { id: p.id, date, format: isReel(p) ? 'reel' : 'post', title }
}
