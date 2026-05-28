import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { hasPermission, type Permission } from './permissions'
import type { UserRole } from '@/lib/supabase/types'

export async function getCurrentRole(): Promise<UserRole | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  return (data?.role as UserRole | undefined) ?? null
}

export async function currentUserHas(perm: Permission): Promise<boolean> {
  const role = await getCurrentRole()
  return hasPermission(role, perm)
}

/**
 * Throw if the current user lacks the permission. Use inside server actions
 * that mutate sensitive data. The error message reaches the client as a
 * friendly toast through the existing { error } shape — keep it Spanish.
 */
export async function requirePermission(perm: Permission): Promise<void> {
  const role = await getCurrentRole()
  if (!hasPermission(role, perm)) {
    throw new Error(`Acceso denegado (falta permiso: ${perm})`)
  }
}

export async function assertOwner(): Promise<void> {
  const role = await getCurrentRole()
  if (role !== 'owner') {
    throw new Error('Esta acción requiere rol de Owner.')
  }
}
