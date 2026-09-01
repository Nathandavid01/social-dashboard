/**
 * Semáforo de aprobación de editores: verde (≥90), amarillo (75–89),
 * rojo (<75), neutro sin historial. Clases Tailwind listas para el badge.
 * PURO — lo usan banco (/banco) y Pipeline.
 */

export type ApprovalToneKind = 'verde' | 'amarillo' | 'rojo' | 'neutro'

export interface ApprovalTone {
  tone: ApprovalToneKind
  /** Clases del badge (borde + fondo + texto). */
  badge: string
}

const TONES: Record<ApprovalToneKind, string> = {
  verde: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400',
  amarillo: 'border-amber-500/40 bg-amber-500/10 text-amber-400',
  rojo: 'border-rose-500/40 bg-rose-500/10 text-rose-400',
  neutro: 'border-border bg-secondary/40 text-muted-foreground',
}

export function approvalTone(rate: number | null | undefined): ApprovalTone {
  const tone: ApprovalToneKind =
    rate == null ? 'neutro' : rate >= 90 ? 'verde' : rate >= 75 ? 'amarillo' : 'rojo'
  return { tone, badge: TONES[tone] }
}
