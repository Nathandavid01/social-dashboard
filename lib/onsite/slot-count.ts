import type { OnsiteProgress, OnsiteShot } from './shot-types'
import { computePostingTargets } from '@/lib/utils/posting-cadence'

function asWeekdays(days: Array<number | string> | null | undefined): number[] {
  return Array.from(new Set(
    (days ?? [])
      .map((d) => Number(d))
      .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6),
  ))
}

/**
 * Videos recomendados en UNA grabación: el /mes de Días de posting × 1.5.
 * Lun+Jue en un mes de 9 posts → 14.
 */
export function onsiteSlotTarget(perMonth: number): number {
  if (!Number.isFinite(perMonth) || perMonth <= 0) return 0
  return Math.round(perMonth * 1.5)
}

export function requiredForOnsite(input: {
  postingDays?: Array<number | string> | null
  ref?: Date
}): { perWeek: number; perMonth: number; slotTarget: number } {
  const days = asWeekdays(input.postingDays)
  const { perWeek, perMonth } = computePostingTargets(days, input.ref)
  return { perWeek, perMonth, slotTarget: onsiteSlotTarget(perMonth) }
}

export function pickOnsiteSession<T extends { id: string; date: string; slotTarget: number; clientId?: string | null }>(
  sessions: T[],
  requestedId: string | undefined,
  today: string,
): T | undefined {
  if (requestedId) {
    const hit = sessions.find((s) => s.id === requestedId)
    if (hit) return hit
  }
  // Calendar order takes priority over client linkage or posting quota.
  const chronological = [...sessions].sort((a, b) => a.date.localeCompare(b.date))
  return chronological.find((s) => s.date >= today) ?? chronological.at(-1)
}

export type OnsiteLane = 'hoy' | 'proxima' | 'pasada' | 'sin_cliente'

export function onsiteLane(s: { date: string; clientId: string | null }, today: string): OnsiteLane {
  if (s.date === today) return 'hoy'
  if (s.date > today) return 'proxima'
  if (!s.clientId) return 'sin_cliente'
  return 'pasada'
}

const LANE_ORDER: OnsiteLane[] = ['hoy', 'proxima', 'pasada', 'sin_cliente']
export const ONSITE_LANE_LABEL: Record<OnsiteLane, string> = {
  hoy: 'Hoy',
  proxima: 'Próximas',
  pasada: 'Anteriores',
  sin_cliente: 'Sin cliente',
}

export function groupOnsiteSessions<T extends { date: string; clientId: string | null }>(
  sessions: T[],
  today: string,
): { lane: OnsiteLane; label: string; items: T[] }[] {
  const buckets = new Map<OnsiteLane, T[]>()
  for (const lane of LANE_ORDER) buckets.set(lane, [])
  for (const s of sessions) {
    buckets.get(onsiteLane(s, today))!.push(s)
  }
  for (const lane of LANE_ORDER) {
    const items = buckets.get(lane)!
    items.sort((a, b) => (lane === 'pasada' || lane === 'sin_cliente'
      ? b.date.localeCompare(a.date)
      : a.date.localeCompare(b.date)))
  }
  return LANE_ORDER
    .map((lane) => ({ lane, label: ONSITE_LANE_LABEL[lane], items: buckets.get(lane)! }))
    .filter((g) => g.items.length > 0)
}

/** Huecos visuales: el objetivo menos las ideas ya en la sesión. */
export function emptyOnsiteSlots(ideaCount: number, slotTarget: number): number {
  return Math.max(0, slotTarget - Math.max(0, ideaCount))
}

/**
 * Progreso contra el recomendado de la sesión. Las ideas de más no se recortan;
 * los huecos vacíos cuentan como pendientes.
 */
export function progressAgainstTarget(shots: OnsiteShot[], slotTarget: number): OnsiteProgress {
  const total = Math.max(shots.length, Math.max(0, slotTarget))
  const recorded = shots.filter((s) => s.recorded).length
  return {
    total,
    recorded,
    pending: total - recorded,
    pct: total === 0 ? 0 : Math.round((recorded / total) * 100),
  }
}
