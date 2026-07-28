import type { UserRole } from '@/lib/supabase/types'

/**
 * Quién puede poner qué rol a quién.
 *
 * Existe porque abrir la gestión de usuarios al supervisor sin límites es una
 * escalada de privilegios con un paso: se asigna 'owner' a sí mismo y ya está.
 * El supervisor reparte los roles de ejecución; tocar owners y supervisores
 * sigue siendo del owner.
 */

/** Roles que un supervisor puede repartir — ninguno le da más poder que él. */
export const SUPERVISOR_ASSIGNABLE: UserRole[] = ['copy', 'editor', 'disenador', 'video']

/** Roles que un supervisor NO puede tocar en otra persona. */
const PROTECTED: UserRole[] = ['owner', 'supervisor']

export interface AssignCheck {
  /** Rol de quien hace el cambio. */
  actor: UserRole | null | undefined
  /** Rol que tiene HOY la persona afectada. */
  targetCurrent: UserRole | null | undefined
  /** Rol que se le quiere poner. */
  next: UserRole
  /** True si el actor se lo está haciendo a sí mismo. */
  isSelf: boolean
}

export function canAssignRole(c: AssignCheck): { ok: boolean; reason?: string } {
  if (c.actor === 'owner') return { ok: true }

  if (c.actor !== 'supervisor') {
    return { ok: false, reason: 'Solo Owner y Supervisor pueden asignar roles.' }
  }

  // Un supervisor cambiándose a sí mismo solo puede bajar de rango, y para eso
  // ya existe pedirlo a un owner. Prohibido y punto: es el vector obvio.
  if (c.isSelf) {
    return { ok: false, reason: 'No puedes cambiar tu propio rol. Pídeselo a un Owner.' }
  }

  if (c.targetCurrent && PROTECTED.includes(c.targetCurrent)) {
    return { ok: false, reason: 'Solo un Owner puede cambiar el rol de un Owner o Supervisor.' }
  }

  if (!SUPERVISOR_ASSIGNABLE.includes(c.next)) {
    return { ok: false, reason: `Un Supervisor no puede asignar el rol ${c.next}.` }
  }

  return { ok: true }
}
