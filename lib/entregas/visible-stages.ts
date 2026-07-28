import { ENTREGA_BATCH_STAGES, type EntregaStageKey } from '@/lib/entregas/batches'
import type { UserRole } from '@/lib/supabase/types'

/**
 * Qué columnas del tablero ve cada rol.
 *
 * No es cosmético: una columna visible es una promesa de que puedes actuar
 * sobre ella. Un editor viendo Copy y Publicación solo aprende a mirar
 * tarjetas que no puede tocar, y el tablero deja de decirle qué le toca.
 *
 * Es un filtro de VISTA. Lo que de verdad protege son los permisos de cada
 * acción (video.approve, posting.publish); esto solo evita enseñar trabajo
 * ajeno.
 */

const ALL = ENTREGA_BATCH_STAGES.map((s) => s.key)

/** Hasta dónde llega cada rol en el flujo. */
const BY_ROLE: Partial<Record<UserRole, EntregaStageKey[]>> = {
  owner: ALL,
  supervisor: ALL,
  // Escribe el copy, así que necesita ver de dónde viene y a dónde va.
  copy: ALL,
  // Entregan y ven el resultado de la revisión — incluido lo devuelto, que es
  // trabajo suyo. Copy y Publicación son de otro.
  editor: ['edited', 'approval'],
  disenador: ['edited', 'approval'],
}

export function visibleEntregaStages(role: UserRole | null | undefined): EntregaStageKey[] {
  if (!role) return []
  return BY_ROLE[role] ?? []
}

export function canSeeEntregaStage(
  role: UserRole | null | undefined,
  stage: EntregaStageKey,
): boolean {
  return visibleEntregaStages(role).includes(stage)
}
