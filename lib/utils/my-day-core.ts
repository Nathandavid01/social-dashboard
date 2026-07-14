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

export type MyDayBucket = 'atrasado' | 'hoy' | 'proximo' | 'esperando'

/**
 * What KIND of work this video needs from me. The load is one number, but the
 * work isn't one thing — a videographer shoots, an editor edits, a supervisor
 * approves. The row shows the kind; the count treats them all as "my hands".
 */
export type MyDayKind = 'grabar' | 'editar' | 'aprobar' | 'publicar' | 'esperar'

export const KIND_LABEL_ES: Record<MyDayKind, string> = {
  grabar: 'Grabar',
  editar: 'Editar',
  aprobar: 'Aprobar',
  publicar: 'Publicar',
  esperar: 'Esperando',
}

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
  kind: MyDayKind
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
  /** They fell back to the team pool but aren't allowed to see it. The screen must
   * say so — claiming "no hay trabajo" would be the same lie this page exists to
   * kill, just pointed the other way. */
  restricted?: boolean
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
 * What this video needs from ME.
 *
 * `canApprove` is the pivot, and getting it wrong is what made the first version
 * lie: a video sitting at `submitted` reads "aprueba o pide cambios" — that is an
 * action, and if I'm the one holding the approve button it is MY action, not
 * someone else's. Filing it under "esperando" hid a supervisor's entire review
 * queue and left it out of their count. For everyone else, the same video really
 * is out of their hands.
 */
export function kindFor(
  v: BatchVideo,
  perms: { canApprove?: boolean; canPublish?: boolean } = {},
): MyDayKind {
  if (v.approval_status === 'submitted') return perms.canApprove ? 'aprobar' : 'esperar'
  // Approved and still not out: what's left is a posting job (or fixing what
  // blocks it). Calling that "editar" mislabeled it, and pinned it on editors who
  // don't even have the publish button.
  if (v.approval_status === 'approved') return perms.canPublish ? 'publicar' : 'esperar'
  if (!isRecorded(v)) return 'grabar'
  return 'editar'
}

/**
 * Where a video lands on my day.
 *
 * Anything I can't act on is `esperando` — nagging me about a date I can't move
 * is noise, and counting it would inflate the very number this screen exists to
 * make trustworthy. Everything else is bucketed by its due date, INCLUDING work
 * that still needs the camera: an unshot video whose date has passed is late,
 * and hiding that would be lying in the other direction.
 *
 * A video with no due date is `proximo`: real, mine, but not claiming a day.
 */
export function bucketFor(
  v: BatchVideo,
  today: string,
  perms: { canApprove?: boolean; canPublish?: boolean } = {},
): MyDayBucket {
  if (kindFor(v, perms) === 'esperar') return 'esperando'
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
function toItems(
  videos: OwnedVideo[],
  today: string,
  perms: { canApprove: boolean; canPublish: boolean },
): MyDayItem[] {
  const items: MyDayItem[] = []
  for (const v of videos) {
    if (v.status === 'descartada') continue
    const nextStep = videoNextStep(v)
    // Published / already queued in Metricool: this is a to-do list, not a history.
    if (isDone(nextStep)) continue
    items.push({
      video: v,
      bucket: bucketFor(v, today, perms),
      kind: kindFor(v, perms),
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
  opts: {
    today: string
    userId?: string | null
    capacity?: number | null
    /** Does this person hold the approve button (`video.approve`)? Decides whether
     * a video in review is their work or someone else's. */
    canApprove?: boolean
    /** Does this person hold the publish button (`posting.publish`)? */
    canPublish?: boolean
  },
): MyDay {
  const { today, userId = null, canApprove = false, canPublish = false } = opts
  const perms = { canApprove, canPublish }

  const mine = userId ? videos.filter((v) => videoOwnerId(v) === userId) : []
  const scope: MyDayScope = mine.length > 0 ? 'mio' : 'equipo'
  // Team view = the UNOWNED work. Someone else's assigned video isn't mine to pick
  // up, and listing it would just recreate the noisy all-videos board.
  const base = scope === 'mio' ? mine : videos.filter((v) => videoOwnerId(v) === null)

  // Approving is a job, not a possession. A video submitted for review needs the
  // approver's hands whoever OWNS it — leaving it off their day (because an editor
  // owns the client) is how a review queue goes unattended for a week.
  const pool = canApprove
    ? [...base, ...videos.filter((v) => v.approval_status === 'submitted' && !base.includes(v))]
    : base

  const items = toItems(pool, today, perms)
  const pick = (b: MyDayBucket) => items.filter((i) => i.bucket === b).sort(byDueDate)
  const atrasados = pick('atrasado')
  const hoy = pick('hoy')

  const capacity = opts.capacity ?? null
  const count = atrasados.length + hoy.length

  return {
    scope,
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
 * The headline.
 *
 * Never say "Tienes" about the team pool — that work isn't theirs, and claiming
 * it is exactly the confusion the `scope` flag exists to prevent.
 */
export function myDayHeadline(load: MyDayLoad, scope: MyDayScope = 'mio'): string {
  if (scope === 'equipo') {
    if (load.count === 0) return 'No hay trabajo libre para hoy'
    if (load.count === 1) return 'Hay 1 video libre para hoy'
    return `Hay ${load.count} videos libres para hoy`
  }
  if (load.count === 0) return 'Nada pendiente para hoy'
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
