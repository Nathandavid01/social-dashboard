import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { hasPermission, type Permission } from './permissions'
import { areaGrantsPermission } from './areas'
import type { UserRole } from '@/lib/supabase/types'

interface RoleAndAreas {
  role: UserRole | null
  areaAccess: string[] | null
}

async function getRoleAndAreas(): Promise<RoleAndAreas> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { role: null, areaAccess: null }
  const { data } = await supabase
    .from('profiles')
    .select('role, area_access')
    .eq('id', user.id)
    .single()
  return {
    role: (data?.role as UserRole | undefined) ?? null,
    areaAccess: (data?.area_access as string[] | null | undefined) ?? null,
  }
}

export async function getCurrentRole(): Promise<UserRole | null> {
  const { role } = await getRoleAndAreas()
  return role
}

export async function currentUserHas(perm: Permission): Promise<boolean> {
  const { role, areaAccess } = await getRoleAndAreas()
  return hasPermission(role, perm) || areaGrantsPermission(perm, role, areaAccess)
}

/**
 * Throw if the current user lacks the permission. A user holds a permission via
 * their role OR via an admin-granted area that maps to it (so an area the admin
 * deliberately opened for an off-role user doesn't 500). Use inside server
 * actions that mutate sensitive data. The message reaches the client as a
 * friendly toast through the existing { error } shape — keep it Spanish.
 */
export async function requirePermission(perm: Permission): Promise<void> {
  const { role, areaAccess } = await getRoleAndAreas()
  if (hasPermission(role, perm)) return
  if (areaGrantsPermission(perm, role, areaAccess)) return
  throw new Error(`Acceso denegado (falta permiso: ${perm})`)
}

export async function assertOwner(): Promise<void> {
  const role = await getCurrentRole()
  if (role !== 'owner') {
    throw new Error('Esta acción requiere rol de Owner.')
  }
}
