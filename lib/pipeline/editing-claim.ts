/**
 * Occupancy claim for Pipeline: who is cutting this idea right now.
 * Lock is `editing_started_by` (not assignment, not production_tasks.en_edicion).
 */

export interface EditingClaim {
  byId: string | null
  byName: string | null
  at: string | null
}

export type ClaimDecision =
  | { ok: true; kind: 'claim' | 'already-mine' }
  | { ok: false; reason: 'taken' | 'unauthenticated'; holder: EditingClaim | null }

export type ReleaseDecision =
  | { ok: true; kind: 'release' | 'already-free' }
  | { ok: false; reason: 'not-holder' | 'unauthenticated'; holder: EditingClaim | null }

export function editingClaimFromFields(
  byId: string | null | undefined,
  at: string | null | undefined,
  name?: string | null,
): EditingClaim {
  if (!byId) return { byId: null, byName: null, at: null }
  return {
    byId,
    byName: name?.trim() || null,
    at: at ?? null,
  }
}

export function isEditingClaimed(claim: EditingClaim | null | undefined): boolean {
  return Boolean(claim?.byId)
}

export function decideEditingClaim(
  claim: EditingClaim | null | undefined,
  userId: string | null,
): ClaimDecision {
  if (!userId) return { ok: false, reason: 'unauthenticated', holder: claim ?? null }
  if (!claim?.byId) return { ok: true, kind: 'claim' }
  if (claim.byId === userId) return { ok: true, kind: 'already-mine' }
  return { ok: false, reason: 'taken', holder: claim }
}

export function decideEditingRelease(
  claim: EditingClaim | null | undefined,
  userId: string | null,
  canForce = false,
): ReleaseDecision {
  if (!userId) return { ok: false, reason: 'unauthenticated', holder: claim ?? null }
  if (!claim?.byId) return { ok: true, kind: 'already-free' }
  if (claim.byId === userId || canForce) return { ok: true, kind: 'release' }
  return { ok: false, reason: 'not-holder', holder: claim }
}

export function applyEditingClaim(
  claim: EditingClaim | null | undefined,
  userId: string,
  nowIso: string,
  name?: string | null,
): EditingClaim {
  const decision = decideEditingClaim(claim, userId)
  if (!decision.ok) return claim ?? { byId: null, byName: null, at: null }
  if (decision.kind === 'already-mine' && claim) {
    return { ...claim, byName: name?.trim() || claim.byName }
  }
  return { byId: userId, byName: name?.trim() || null, at: nowIso }
}

export function editingClaimLabel(claim: EditingClaim | null | undefined, userId: string | null): string | null {
  if (!claim?.byId) return null
  const name = claim.byId === userId ? 'tú' : (claim.byName?.trim() || 'alguien')
  return `En edición — ${name}`
}

export function editingClaimConflictMessage(claim: EditingClaim | null | undefined): string {
  const name = (claim?.byName?.trim() || 'otra persona').replace(/\.+$/, '')
  return `Este video ya lo está editando ${name}.`
}

export function formatEditingClaimWhen(at: string | null | undefined, now: Date = new Date()): string | null {
  if (!at) return null
  const then = new Date(at)
  if (!Number.isFinite(then.getTime())) return null
  const diffMs = now.getTime() - then.getTime()
  if (diffMs < 45_000) return 'ahora'
  if (diffMs < 60 * 60_000) {
    const mins = Math.max(1, Math.round(diffMs / 60_000))
    return mins === 1 ? 'hace 1 min' : `hace ${mins} min`
  }
  const sameDay =
    then.getFullYear() === now.getFullYear() &&
    then.getMonth() === now.getMonth() &&
    then.getDate() === now.getDate()
  const hh = String(then.getHours()).padStart(2, '0')
  const mm = String(then.getMinutes()).padStart(2, '0')
  if (sameDay) return `hoy ${hh}:${mm}`
  const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  return `${then.getDate()} ${MES[then.getMonth()]} ${hh}:${mm}`
}
