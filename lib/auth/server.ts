import 'server-only'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hasPermission, type Permission } from './permissions'
import { areaGrantsPermission } from './areas'
import { ROLE_PREVIEW_COOKIE, resolveRolePreview } from './role-preview-core'
import type { UserRole } from '@/lib/supabase/types'

export interface CurrentAccessContext {
  role: UserRole | null
  areaAccess: string[] | null
  actualRole: UserRole | null
  isRolePreview: boolean
}

/**
 * Backfill a profiles row when auth.users exists but the signup trigger did not
 * run (common in local dev or users created via the Supabase dashboard).
 */
async function ensureProfileRole(user: {
  id: string
  email?: string | null
  user_metadata?: Record<string, unknown>
}): Promise<UserRole | null> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null

  try {
    const admin = createAdminClient()
    if (!admin) return null

    const { count } = await admin.from('profiles').select('id', { count: 'exact', head: true })
    const role: UserRole = (count ?? 0) === 0 ? 'owner' : 'editor'

    await admin.from('profiles').upsert(
      {
        id: user.id,
        email: user.email ?? '',
        full_name: (user.user_metadata?.full_name as string | undefined) ?? '',
        role,
      },
      { onConflict: 'id', ignoreDuplicates: true },
    )

    const { data } = await admin.from('profiles').select('role').eq('id', user.id).single()
    return (data?.role as UserRole | undefined) ?? null
  } catch {
    return null
  }
}

async function getActualRoleAndAreas(): Promise<Pick<CurrentAccessContext, 'role' | 'areaAccess'>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { role: null, areaAccess: null }

  const { data } = await supabase
    .from('profiles')
    .select('role, area_access')
    .eq('id', user.id)
    .maybeSingle()

  if (data?.role) {
    return {
      role: data.role as UserRole,
      areaAccess: (data.area_access as string[] | null | undefined) ?? null,
    }
  }

  const backfilled = await ensureProfileRole(user)
  if (!backfilled) return { role: null, areaAccess: null }

  const { data: refreshed } = await supabase
    .from('profiles')
    .select('role, area_access')
    .eq('id', user.id)
    .maybeSingle()

  return {
    role: (refreshed?.role as UserRole | undefined) ?? backfilled,
    areaAccess: (refreshed?.area_access as string[] | null | undefined) ?? null,
  }
}

export async function getCurrentAccessContext(): Promise<CurrentAccessContext> {
  const actual = await getActualRoleAndAreas()
  const cookieStore = await cookies()
  const previewRole = resolveRolePreview(
    actual.role,
    cookieStore.get(ROLE_PREVIEW_COOKIE)?.value,
    process.env.NODE_ENV === 'production',
  )

  return {
    role: previewRole ?? actual.role,
    areaAccess: previewRole ? null : actual.areaAccess,
    actualRole: actual.role,
    isRolePreview: previewRole !== null,
  }
}

async function getRoleAndAreas(): Promise<Pick<CurrentAccessContext, 'role' | 'areaAccess'>> {
  const { role, areaAccess } = await getCurrentAccessContext()
  return { role, areaAccess }
}

export async function getActualCurrentRole(): Promise<UserRole | null> {
  const { role } = await getActualRoleAndAreas()
  return role
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
  if (!role) {
    throw new Error('Acceso denegado (perfil no configurado — contacta a un Owner)')
  }
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

export async function assertActualOwner(): Promise<void> {
  const role = await getActualCurrentRole()
  if (role !== 'owner') {
    throw new Error('Esta acción requiere una cuenta Owner.')
  }
}
