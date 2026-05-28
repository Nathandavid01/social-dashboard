'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { assertOwner } from '@/lib/auth/server'
import { ASSIGNABLE_ROLES } from '@/lib/auth/permissions'
import type { UserRole } from '@/lib/supabase/types'

export async function changeUserRole(
  userId: string,
  newRole: UserRole,
): Promise<{ ok?: true; error?: string }> {
  try {
    await assertOwner()
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }
  if (!ASSIGNABLE_ROLES.includes(newRole)) {
    return { error: `Rol inválido: ${newRole}` }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

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
