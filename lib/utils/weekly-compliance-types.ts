// Pure types + status derivation for the weekly posting-compliance dashboard.
// NO server imports here — the live ('use client') card imports this file, so
// it must never transitively pull in lib/supabase/server. See CLAUDE.md.

export type WeeklyComplianceStatus =
  | 'completo'     // published >= quota
  | 'al_dia'       // on pace for the week
  | 'atrasado'     // behind the expected pace
  | 'sin_empezar'  // quota > 0 but nothing published yet
  | 'sin_meta'     // no weekly_post_quota configured

export interface ClientWeeklyCompliance {
  clientId: string
  clientName: string
  quota: number | null
  published: number
  status: WeeklyComplianceStatus
}

export interface WeeklyComplianceSummary {
  weekStart: string // YYYY-MM-DD (Monday)
  weekEnd: string   // YYYY-MM-DD (Sunday)
  /** 1..7 — how many days of the week have elapsed (incl. today). */
  daysElapsed: number
  clients: ClientWeeklyCompliance[]
  totalQuota: number
  totalPublished: number
}

export const COMPLIANCE_META: Record<
  WeeklyComplianceStatus,
  { label: string; bar: string; badge: string; dot: string }
> = {
  completo:    { label: 'Completo',    bar: '#22c55e', badge: 'bg-green-500/15 text-green-600',   dot: 'bg-green-500' },
  al_dia:      { label: 'Al día',      bar: '#3b82f6', badge: 'bg-blue-500/15 text-blue-600',     dot: 'bg-blue-500' },
  atrasado:    { label: 'Atrasado',    bar: '#f97316', badge: 'bg-orange-500/15 text-orange-600', dot: 'bg-orange-500' },
  sin_empezar: { label: 'Sin empezar', bar: '#ef4444', badge: 'bg-red-500/15 text-red-600',       dot: 'bg-red-500' },
  sin_meta:    { label: 'Sin meta',    bar: '#a1a1aa', badge: 'bg-zinc-500/15 text-zinc-500',     dot: 'bg-zinc-400' },
}

/**
 * Derive a client's weekly status from quota, posts published this week, and
 * how far into the week we are. Pure — usable on server and client.
 */
export function deriveComplianceStatus(
  quota: number | null,
  published: number,
  daysElapsed: number,
): WeeklyComplianceStatus {
  if (quota === null || quota === 0) return quota === 0 ? 'completo' : 'sin_meta'
  if (published >= quota) return 'completo'
  if (published === 0) return 'sin_empezar'
  // Expected posts by this point in the week, rounded down — being exactly on
  // the floor of the pace counts as "al día".
  const expectedByNow = Math.floor((quota * daysElapsed) / 7)
  return published >= expectedByNow ? 'al_dia' : 'atrasado'
}
