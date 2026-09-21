import type { UserRole } from '@/lib/supabase/types'

/**
 * Quién puede ponerle una contraseña nueva a quién.
 *
 * Misma frontera que los roles: el supervisor administra al equipo de
 * ejecución, y no puede tocar la cuenta de un owner ni de otro supervisor.
 * La contraseña propia se cambia en Cuenta → Seguridad.
 */

const EXECUTION: UserRole[] = ['copy', 'editor', 'disenador', 'video', 'team_member']

export interface PasswordResetCheck {
  actor: UserRole | null | undefined
  targetRole: UserRole | null | undefined
  isSelf: boolean
}

export function canResetPassword(
  c: PasswordResetCheck,
): { ok: true } | { ok: false; reason: string } {
  if (c.actor !== 'owner' && c.actor !== 'supervisor') {
    return { ok: false, reason: 'Solo un Owner o un Supervisor puede asignar contraseñas.' }
  }

  if (c.isSelf) {
    return { ok: false, reason: 'Tu contraseña se cambia en Cuenta → Seguridad.' }
  }

  if (!c.targetRole) {
    return { ok: false, reason: 'No encontramos el rol de esa persona.' }
  }

  if (c.actor === 'supervisor' && !EXECUTION.includes(c.targetRole)) {
    return { ok: false, reason: 'Solo un Owner puede asignar la contraseña de un Owner o Supervisor.' }
  }

  return { ok: true }
}
