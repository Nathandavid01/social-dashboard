'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentRole } from '@/lib/auth/server'
import { ASSIGNABLE_ROLES } from '@/lib/auth/permissions'
import { canAssignRole } from '@/lib/auth/role-assignment'
import type { UserRole } from '@/lib/supabase/types'

export async function changeUserRole(
  userId: string,
  newRole: UserRole,
): Promise<{ ok?: true; error?: string }> {
  if (!ASSIGNABLE_ROLES.includes(newRole)) {
    return { error: `Rol inválido: ${newRole}` }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // Quién puede poner qué a quién. Se comprueba con el rol ACTUAL del afectado
  // leído del servidor, no con lo que diga el cliente: si no, un supervisor
  // podría afirmar que un owner es "editor" y degradarlo.
  const [actorRole, { data: target }] = await Promise.all([
    getCurrentRole(),
    supabase.from('profiles').select('role').eq('id', userId).single(),
  ])
  const verdict = canAssignRole({
    actor: actorRole,
    targetCurrent: (target?.role as UserRole | undefined) ?? null,
    next: newRole,
    isSelf: user.id === userId,
  })
  if (!verdict.ok) return { error: verdict.reason ?? 'No autorizado' }

  // Safeguard: never let the last owner demote themselves accidentally.
  if (user.id === userId && newRole !== 'owner') {
    const { count } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'owner')
    if ((count ?? 0) <= 1) {
      return { error: 'No puedes cambiar tu propio rol siendo el último Owner.' }
    }
  }

  const { error } = await supabase
    .from('profiles')
    .update({ role: newRole, updated_at: new Date().toISOString() })
    .eq('id', userId)
  if (error) return { error: error.message }

  revalidatePath('/team')
  return { ok: true }
}
