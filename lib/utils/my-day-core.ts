/**
 * "Mi día" — the one screen an editor / videographer / assistant opens to know
 * what they have to do TODAY.
 *
 * This is the piece the dashboard was missing (and the reason the team still
 * lived in ClickUp): there was no notion of per-person, per-day load anywhere in
 * the app. Everything here is pure so the rules are testable without a DB.
 *
 * Two ideas carry the whole screen:
 *
 *  1. **Not everything assigned to you is yours to act on right now.** A video
 *     sitting with the client is on your list but not on your plate — it can't
 *     be "work you have to do today". Those go to `esperando` and never count
 *     against your load, so the count stays honest.
 *
 *  2. **The due date is the one the person actually committed to.** `deadline`
 *     (a human-set due date) wins over `publish_date` (when it goes out). All
 *     compares are date-only "YYYY-MM-DD" strings — never `toISOString()`, which
 *     shifts the day at night because the server runs in UTC (see deadlines.ts).
 */
import type { BatchVideo, NextStep } from '@/lib/utils/batch-view'
import { videoNextStep, isRecorded } from '@/lib/utils/batch-view'
import type { Client, ProductionTask } from '@/lib/supabase/types'

export type MyDayBucket = 'por_grabar' | 'atrasado' | 'hoy' | 'proximo' | 'esperando'

/**
 * A video whose owner we can resolve. `production_task.assigned_to_id` is the
 * explicit, per-video assignment; `client.assigned_to` is who runs the account.
 */
export interface OwnedVideo extends BatchVideo {
  /** BatchVideo's task, plus `assigned_to_id` — the explicit per-video owner. */
  production_task?: (Pick<ProductionTask, 'id' | 'status' | 'publish_date'> & {
    assigned_to_id?: string | null
  }) | null
  /** BatchVideo's client, plus `assigned_to` — who runs the account. */
  client?: (Pick<Client, 'id' | 'name' | 'industry'> & {
    logo_url?: string | null
    assigned_to?: string | null
  }) | null
}

/**
 * Who owns this video.
 *
 * The account owner owns their videos — that's how the agency actually works
 * ("Anibeliz lleva estos 12 clientes"), and it's what makes the screen useful on
 * day one: assign 63 clients once instead of 154 videos, and every new video is
 * owned the moment it's created.
 *
 * A per-video assignment still WINS when someone sets one, so a single video can
 * be handed off without moving the whole account.
 *
 * Returns null when nobody owns it — that's real, and the UI surfaces it as
 * unclaimed team work rather than pretending it belongs to someone.
 */
export function videoOwnerId(v: OwnedVideo): string | null {
  const explicit = v.production_task?.assigned_to_id
  if (explicit) return explicit
  const viaClient = v.client?.assigned_to
  if (viaClient) return viaClient
  return null
}

export interface MyDayItem {
  video: OwnedVideo
  bucket: MyDayBucket
  /** The date this is due: `deadline` if set, else `publish_date`. */
  dueDate: string | null
  nextStep: NextStep
}

export interface MyDayLoad {
  /** Videos that need MY hands today (atrasados + hoy). */
  count: number
  /** The person's configured ceiling. null = no ceiling set. */
  capacity: number | null
  /** Over their configured ceiling → the UI warns. */
  over: boolean
}

/**
 * Whose work am I looking at? `mio` = assigned to me. `equipo` = I have nothing
 * assigned, so we show the team's open work instead of an empty screen — people
 * can see what needs doing and pick it up. The UI must SAY which one it is; a
 * silent fallback would let someone think unowned work is theirs.
 */
export type MyDayScope = 'mio' | 'equipo'

export interface MyDay {
  scope: MyDayScope
  /** Planned slots nobody has shot yet. Real work — but camera work, and never
   * part of the editing load. */
  porGrabar: MyDayItem[]
  atrasados: MyDayItem[]
  hoy: MyDayItem[]
  proximos: MyDayItem[]
  esperando: MyDayItem[]
  load: MyDayLoad
}

/** Videos that are finished (published or already queued in Metricool). */
function isDone(step: NextStep): boolean {
  return step.tone === 'done'
}

/**
 * The date the video is due. `deadline` is the date a human committed to;
 * `publish_date` is when it goes out. Prefer the commitment.
 */
export function videoDueDate(v: BatchVideo): string | null {
  const deadline = (v as { deadline?: string | null }).deadline
  if (deadline && deadline.trim()) return deadline.trim()
  if (v.publish_date && String(v.publish_date).trim()) return String(v.publish_date).trim()
  return null
}

/**
 * Where a video lands on my day.
 *
 * `por_grabar` comes FIRST, and it is the rule that keeps this screen usable.
 * Most of the board is planned slots that were never shot — a date and a client,
 * nothing else. They are real work, but they are CAMERA work, and they are not
 * what a daily editing ceiling is about. Bucketing them by their (long past)
 * planned date would bury the real work under a wall of red: on the live board
 * that's 150 "atrasados" and 0 actual videos. So they get their own section and
 * they never touch the load count.
 *
 * `waiting` work (with the client, or in someone else's review) is `esperando`
 * no matter how overdue it looks — nagging me about a date I can't move is noise,
 * and counting it would inflate the very number this screen exists to make
 * trustworthy.
 *
 * A video with no due date is `proximo`: real, mine, but not claiming a day.
 */
export function bucketFor(v: BatchVideo, today: string): MyDayBucket {
  const step = videoNextStep(v)
  if (step.tone === 'waiting') return 'esperando'
  if (!isRecorded(v)) return 'por_grabar'
  const due = videoDueDate(v)
  if (!due) return 'proximo'
  if (due < today) return 'atrasado'
  if (due === today) return 'hoy'
  return 'proximo'
}

/** Sort key: soonest first; no-date last. Stable tiebreak by title. */
function byDueDate(a: MyDayItem, b: MyDayItem): number {
  if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1
  if (a.dueDate && !b.dueDate) return -1
  if (!a.dueDate && b.dueDate) return 1
  return (a.video.title ?? '').localeCompare(b.video.title ?? '')
}

/** Turn raw videos into day items, dropping what's finished or discarded. */
function toItems(videos: OwnedVideo[], today: string): MyDayItem[] {
  const items: MyDayItem[] = []
  for (const v of videos) {
    if (v.status === 'descartada') continue
    const nextStep = videoNextStep(v)
    // Published / already queued in Metricool: this is a to-do list, not a history.
    if (isDone(nextStep)) continue
    items.push({
      video: v,
      bucket: bucketFor(v, today),
      dueDate: videoDueDate(v),
      nextStep,
    })
  }
  return items
}

/**
 * Build one person's day out of ALL the active videos.
 *
 * Pass everything; this picks out what's theirs (`videoOwnerId`). When nothing
 * is, it falls back to the team's OPEN work — the videos nobody owns — so the
 * screen is useful before a single assignment exists, instead of greeting a new
 * editor with a blank page. `scope` says which of the two you got; the UI has to
 * show it, or unowned work reads as assigned.
 */
export function buildMyDay(
  videos: OwnedVideo[],
  opts: { today: string; userId?: string | null; capacity?: number | null },
): MyDay {
  const { today, userId = null } = opts

  const mine = userId ? videos.filter((v) => videoOwnerId(v) === userId) : []
  const scope: MyDayScope = mine.length > 0 ? 'mio' : 'equipo'
  // Team view = the UNOWNED work. Someone else's assigned video isn't mine to pick
  // up, and listing it would just recreate the noisy all-videos board.
  const pool = scope === 'mio' ? mine : videos.filter((v) => videoOwnerId(v) === null)

  const items = toItems(pool, today)
  const pick = (b: MyDayBucket) => items.filter((i) => i.bucket === b).sort(byDueDate)
  const atrasados = pick('atrasado')
  const hoy = pick('hoy')

  const capacity = opts.capacity ?? null
  const count = atrasados.length + hoy.length

  return {
    scope,
    porGrabar: pick('por_grabar'),
    atrasados,
    hoy,
    proximos: pick('proximo'),
    esperando: pick('esperando'),
    load: {
      count,
      capacity,
      // A capacity of 0 means "none today" — `> 0` would swallow that, so compare
      // against null explicitly.
      // Only warn about MY ceiling; the team pool isn't my personal load.
      over: scope === 'mio' && capacity !== null && count > capacity,
    },
  }
}

/**
 * The headline: "Tienes 6 videos hoy".
 *
 * With nothing to edit, don't just say "nada pendiente" while a pile of unshot
 * slots sits below — that reads as a bug. Name the camera work instead, since
 * that IS what's pending.
 */
export function myDayHeadline(load: MyDayLoad, porGrabar = 0): string {
  if (load.count === 0) {
    if (porGrabar === 1) return 'Nada que editar hoy · 1 video por grabar'
    if (porGrabar > 1) return `Nada que editar hoy · ${porGrabar} videos por grabar`
    return 'Nada pendiente para hoy'
  }
  if (load.count === 1) return 'Tienes 1 video hoy'
  return `Tienes ${load.count} videos hoy`
}

/** The honest subtitle about capacity. null when no ceiling is configured. */
export function myDayCapacityNote(load: MyDayLoad): string | null {
  if (load.capacity === null) return null
  if (load.over) {
    const extra = load.count - load.capacity
    return `Estás sobre tu tope de ${load.capacity} por día (${extra} de más). Habla con tu supervisor.`
  }
  return `Tu tope es ${load.capacity} por día.`
}
