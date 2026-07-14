/**
 * "Esta semana toca" — with ~50 clients, the question on a Monday is not "how is
 * every client doing" but "which ones do I actually have to touch NOW?"
 *
 * Eric's words: *"no todos los clientes necesito hacer los cinco videos, porque
 * no todo se va mañana."* The board shows all 50 equally; nothing in the app ever
 * looked across clients and said which ones are running out. This does.
 *
 * Two rules keep the list honest:
 *
 *  1. **The buckets ARE the runway status.** `computeRunway` already grades every
 *     client (ok / warn / risk) against the product's stated goal of one month of
 *     buffered content. Inventing a second set of thresholds here put the same
 *     client in "Pueden esperar" (green) up top and "Atrasado" (amber) on the
 *     board 300px below. One source of truth, no contradiction.
 *
 *  2. **Say WHICH stage is empty.** The runway is the MIN of ideas/recorded/edited,
 *     so a client with 20 shot videos waiting on an editor looks identical to one
 *     with nothing at all. Telling you to go shoot the first one is worse than
 *     saying nothing. The reason names the empty stage, so the list tells you what
 *     to DO, not just who is in trouble.
 */
import { TARGET_WEEKS, type Runway } from '@/lib/utils/content-runway'
import { formatDateShortES } from '@/lib/utils/deadlines'

/** A client, reduced to what the decision needs. */
export interface WeeklyPlanClient {
  clientId: string
  clientName: string
  /** Posts per week they've committed to. 0 = no cadence configured. */
  weeklyCadence: number
  runway: Runway
  /**
   * The soonest date this client is committed to publish something that isn't out
   * yet ("YYYY-MM-DD"), or null if we can't know.
   *
   * This is what makes the list ACTIONABLE. On the live account every client sits
   * at zero weeks of buffered content, so they all tie on runway — who publishes
   * FIRST is what decides who you shoot on Monday. An OVERDUE date is the most
   * urgent thing there is, so it sorts first, not last.
   */
  nextPublishDate?: string | null
}

export type WeeklyPlanBucket = 'urgente' | 'esta_semana' | 'puede_esperar' | 'sin_cadencia'

export interface WeeklyPlanItem extends WeeklyPlanClient {
  bucket: WeeklyPlanBucket
  /** Plain-Spanish reason, so the list explains itself. */
  reason: string
}

export interface WeeklyPlan {
  urgentes: WeeklyPlanItem[]
  estaSemana: WeeklyPlanItem[]
  puedenEsperar: WeeklyPlanItem[]
  sinCadencia: WeeklyPlanItem[]
  /** Clients that need a human this week (urgentes + estaSemana). */
  tocanCount: number
  total: number
}

function weeksLabel(w: number): string {
  const r = Math.round(w * 10) / 10
  if (r < 1) return 'menos de 1 semana'
  if (r < 2) return '1 semana'
  return `${Math.round(r)} semanas`
}

/**
 * Which stage is the bottleneck, and therefore what to actually do.
 *
 * Order matters: a client can be empty at several stages at once, and the FIRST
 * empty one is what blocks the rest — you can't edit what wasn't shot.
 */
function bottleneck(r: Runway): { what: string; action: string } | null {
  const ideas = r.ideasWeeks ?? 0
  const recorded = r.recordedWeeks ?? 0
  const edited = r.editedWeeks ?? 0
  const min = Math.min(ideas, recorded, edited)

  if (ideas === min) return { what: 'sin ideas', action: 'Hay que planificar contenido' }
  if (recorded === min) return { what: 'nada grabado', action: 'Hay que grabar' }
  if (edited === min) return { what: 'nada editado', action: 'Hay que editar' }
  return null
}

/**
 * Which bucket a client falls in, and why.
 *
 * The bucket comes straight from `runway.status` — the same grade the board shows
 * — so the two can never disagree. A client with NO cadence is set aside rather
 * than guessed at: we don't know how fast they burn content, and calling them
 * "fine" would quietly hide a client nobody is serving.
 *
 * `today` is only used to tell an overdue commitment from a future one — the copy
 * must not say "Publica el 1 jul" about a date that passed two weeks ago.
 */
export function bucketClient(
  c: WeeklyPlanClient,
  today?: string,
): { bucket: WeeklyPlanBucket; reason: string } {
  const { runway, weeklyCadence } = c

  if (weeklyCadence <= 0 || runway.status === 'no_cadence' || runway.minWeeks === null) {
    return {
      bucket: 'sin_cadencia',
      reason: 'Sin cadencia configurada — no sabemos cuánto contenido necesita.',
    }
  }

  const min = runway.minWeeks

  // The commitment, stated honestly. An overdue date is not "publica el 1 jul".
  let when = ''
  if (c.nextPublishDate) {
    const overdue = today != null && c.nextPublishDate < today
    when = overdue
      ? ` Debió publicar el ${formatDateShortES(c.nextPublishDate)}.`
      : ` Publica el ${formatDateShortES(c.nextPublishDate)}.`
  }

  if (runway.status === 'risk') {
    const b = bottleneck(runway)
    // Name the empty stage: "20 grabados, nada editado" needs an editor, not a
    // camera. The MIN alone would send you to shoot a client who doesn't need it.
    const head = b ? `${b.action} — ${b.what}` : `Sin contenido listo (${weeksLabel(min)})`
    return { bucket: 'urgente', reason: `${head}.${when}` }
  }

  if (runway.status === 'warn') {
    const b = bottleneck(runway)
    const head = b
      ? `${weeksLabel(min)} en banco — ${b.action.toLowerCase()}`
      : `Le quedan ${weeksLabel(min)}`
    return { bucket: 'esta_semana', reason: `${head}.${when}` }
  }

  return {
    bucket: 'puede_esperar',
    reason: `Tiene ${weeksLabel(min)} de contenido en banco.`,
  }
}

/**
 * Soonest-to-run-out first, then whoever publishes soonest, then by name.
 *
 * The middle key carries the list in practice: when the whole account is at zero
 * buffered content, every client ties on runway, and sorting the rest
 * alphabetically would be the same as not sorting at all.
 *
 * A client with NO date sorts FIRST among equals, not last: "no date" means we
 * found no content for them at all, which is the worst case, not the calmest.
 */
function byUrgency(a: WeeklyPlanItem, b: WeeklyPlanItem): number {
  const am = a.runway.minWeeks ?? Infinity
  const bm = b.runway.minWeeks ?? Infinity
  if (am !== bm) return am - bm

  // Date-only string compare — never `new Date()`, which shifts the day at night.
  // '' sorts before any real date, so "nothing scheduled at all" leads.
  const ad = a.nextPublishDate ?? ''
  const bd = b.nextPublishDate ?? ''
  if (ad !== bd) return ad < bd ? -1 : 1

  return a.clientName.localeCompare(b.clientName)
}

/**
 * Split every client into "touch this week" vs "can wait".
 *
 * The point is the SHORT list: open the app on a Monday and see 8 clients, not
 * 50. `puedenEsperar` is kept (collapsed in the UI) rather than hidden — a client
 * you can't see is a client you can't sanity-check.
 */
export function planWeek(clients: WeeklyPlanClient[], today?: string): WeeklyPlan {
  const items: WeeklyPlanItem[] = clients.map((c) => ({ ...c, ...bucketClient(c, today) }))
  const pick = (b: WeeklyPlanBucket) => items.filter((i) => i.bucket === b).sort(byUrgency)

  const urgentes = pick('urgente')
  const estaSemana = pick('esta_semana')

  return {
    urgentes,
    estaSemana,
    puedenEsperar: pick('puede_esperar'),
    sinCadencia: pick('sin_cadencia'),
    tocanCount: urgentes.length + estaSemana.length,
    total: items.length,
  }
}

/** The headline: "Esta semana tocan 8 de 50 clientes". */
export function weeklyPlanHeadline(plan: WeeklyPlan): string {
  if (plan.total === 0) return 'No hay clientes activos'
  if (plan.tocanCount === 0) return `Ningún cliente necesita atención esta semana (${plan.total} al día)`
  if (plan.tocanCount === 1) return `Esta semana toca 1 cliente de ${plan.total}`
  return `Esta semana tocan ${plan.tocanCount} clientes de ${plan.total}`
}

/** Sub-line: how healthy the rest is. Measured against the product's stated goal. */
export function weeklyPlanSubline(plan: WeeklyPlan): string {
  const parts: string[] = []
  if (plan.urgentes.length > 0) {
    parts.push(
      plan.urgentes.length === 1
        ? '1 se queda sin contenido ya'
        : `${plan.urgentes.length} se quedan sin contenido ya`,
    )
  }
  if (plan.puedenEsperar.length > 0) {
    // `puede_esperar` IS the runway's 'ok' status, i.e. at or above the goal.
    parts.push(`${plan.puedenEsperar.length} con ${TARGET_WEEKS}+ semanas en banco pueden esperar`)
  }
  if (plan.sinCadencia.length > 0) {
    parts.push(`${plan.sinCadencia.length} sin cadencia configurada`)
  }
  return parts.join(' · ')
}
