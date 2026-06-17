import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hasPermission, type Permission } from './permissions'
import type { UserRole } from '@/lib/supabase/types'

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

export async function getCurrentRole(): Promise<UserRole | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (data?.role) return data.role as UserRole

  return ensureProfileRole(user)
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
  if (!role) {
    throw new Error('Acceso denegado (perfil no configurado — contacta a un Owner)')
  }
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
