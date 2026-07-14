/**
 * "Esta semana toca" — with ~50 clients, the question on a Monday is not "how is
 * every client doing" but "which ones do I actually have to touch NOW?"
 *
 * Eric's words: *"no todos los clientes necesito hacer los cinco videos, porque
 * no todo se va mañana."* The board shows all 50 equally; nothing in the app ever
 * looked across clients and said which ones are running out. This does.
 *
 * The split is driven by the content RUNWAY (weeks of buffered content vs. the
 * client's posting cadence), which the app already computes per client — this
 * only decides what to DO about it, and it's pure so the rule is testable.
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
   * The soonest date this client is committed to publish something that isn't
   * ready yet ("YYYY-MM-DD"), or null if nothing is scheduled.
   *
   * This is what makes the list ACTIONABLE. On the live account every client is
   * at zero weeks of buffered content — nothing recorded, nothing edited — so
   * they all tie at "urgente" and the runway alone can't rank them. Who publishes
   * FIRST is the question that actually decides who you shoot on Monday.
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

/** Content runs out in under this many weeks → it's an emergency. */
const URGENT_WEEKS = 1

/** Under this, it needs attention this week (TARGET_WEEKS is the healthy buffer). */
const ATTENTION_WEEKS = 2

function weeksLabel(w: number): string {
  if (w < 1) return 'menos de 1 semana'
  if (w < 2) return '1 semana'
  return `${Math.floor(w)} semanas`
}

/**
 * Which bucket a client falls in, and why.
 *
 * A client with NO cadence can't have a runway (we don't know how fast they burn
 * content), so they're set aside rather than guessed at — pretending they're
 * "fine" would quietly hide a client nobody is serving.
 */
export function bucketClient(c: WeeklyPlanClient): { bucket: WeeklyPlanBucket; reason: string } {
  const { runway, weeklyCadence } = c

  if (weeklyCadence <= 0 || runway.minWeeks === null || runway.status === 'no_cadence') {
    return {
      bucket: 'sin_cadencia',
      reason: 'Sin cadencia configurada — no sabemos cuánto contenido necesita.',
    }
  }

  const min = runway.minWeeks

  if (min < URGENT_WEEKS) {
    // Name the commitment when there is one: "publica el 16 jul y no hay nada
    // grabado" tells you what to do; "se le acaba el contenido" doesn't.
    const when = c.nextPublishDate ? ` Publica el ${formatDateShortES(c.nextPublishDate)}.` : ''
    return {
      bucket: 'urgente',
      reason: `Sin contenido listo (${weeksLabel(min)}).${when}`,
    }
  }

  if (min < ATTENTION_WEEKS) {
    return {
      bucket: 'esta_semana',
      reason: `Le quedan ${weeksLabel(min)} de contenido. Toca reponer.`,
    }
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
 */
function byUrgency(a: WeeklyPlanItem, b: WeeklyPlanItem): number {
  const am = a.runway.minWeeks ?? Infinity
  const bm = b.runway.minWeeks ?? Infinity
  if (am !== bm) return am - bm

  // Date-only string compare — never `new Date()`, which shifts the day at night.
  const ad = a.nextPublishDate ?? '9999-12-31'
  const bd = b.nextPublishDate ?? '9999-12-31'
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
export function planWeek(clients: WeeklyPlanClient[]): WeeklyPlan {
  const items: WeeklyPlanItem[] = clients.map((c) => ({ ...c, ...bucketClient(c) }))
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

/** Sub-line: how healthy the rest is. */
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
    parts.push(`${plan.puedenEsperar.length} con ${TARGET_WEEKS}+ semanas en banco pueden esperar`)
  }
  if (plan.sinCadencia.length > 0) {
    parts.push(`${plan.sinCadencia.length} sin cadencia configurada`)
  }
  return parts.join(' · ')
}
