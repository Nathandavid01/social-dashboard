/**
 * Pure validation for a self-service password change. Kept out of the
 * `'use server'` action so the rules are unit-testable without Supabase.
 * The logged-in user supplies their current password (re-verified server-side),
 * a new password, and a confirmation.
 */
export const MIN_PASSWORD_LENGTH = 8

export interface PasswordChangeInput {
  current: string
  next: string
  confirm: string
}

export type PasswordChangeValidation = { ok: true } | { ok: false; error: string }

export function validatePasswordChange(input: Partial<PasswordChangeInput>): PasswordChangeValidation {
  const current = input.current ?? ''
  const next = input.next ?? ''
  const confirm = input.confirm ?? ''

  if (!current) return { ok: false, error: 'Escribe tu contraseña actual.' }
  if (next.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: `La nueva contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.` }
  }
  if (next !== confirm) return { ok: false, error: 'Las contraseñas no coinciden.' }
  if (next === current) return { ok: false, error: 'La nueva contraseña debe ser diferente a la actual.' }
  return { ok: true }
}
