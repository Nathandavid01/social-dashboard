'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertOwner } from '@/lib/auth/server'
import { validateNewUser } from '@/lib/utils/user-admin-core'
import { AREAS } from '@/lib/auth/areas'
import type { UserRole, UserStatus } from '@/lib/supabase/types'

type Result = { ok?: true; error?: string }

/**
 * Owner-only: create a brand-new team user with a role (= their permission set)
 * and a temporary password they change on first login. Uses the service-role
 * admin API to create the auth user (email pre-confirmed), then sets the chosen
 * role on the profile the signup trigger created. The same table lets the owner
 * change a user's role/permissions afterward via RoleSelector.
 */
export async function createTeamUser(input: {
  email: string
  fullName: string
  role: UserRole
  password: string
}): Promise<{ ok?: true; userId?: string; error?: string }> {
  try {
    await assertOwner()
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  const valid = validateNewUser(input)
  if (!valid.ok) return { error: valid.error }

  const admin = createAdminClient()
  if (!admin) return { error: 'Falta configurar SUPABASE_SERVICE_ROLE_KEY en el servidor.' }

  const email = input.email.trim().toLowerCase()
  const fullName = input.fullName.trim()

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })
  if (error) return { error: error.message }
  const userId = data.user?.id
  if (!userId) return { error: 'No se pudo crear el usuario.' }

  // The handle_new_user trigger inserts the profile with the default role; set
  // the chosen role + name with the admin client (RLS-free, just-created row).
  // Owner-created users skip the approval queue — the owner vouches for them.
  const { error: updErr } = await admin
    .from('profiles')
    .update({
      role: input.role,
      full_name: fullName,
      status: 'active',
      approval_status: 'approved',
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
  if (updErr) return { error: updErr.message }

  revalidatePath('/team')
  return { ok: true, userId }
}

/** Owner-only: edit a member's display name and org title. */
export async function updateUserProfile(
  userId: string,
  values: { full_name: string; title?: string | null },
): Promise<Result> {
  try {
    await assertOwner()
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }
  const fullName = values.full_name?.trim()
  if (!fullName) return { error: 'El nombre no puede estar vacío.' }
  const title = values.title?.trim() || null

  const supabase = await createClient()
  const { error } = await supabase
    .from('profiles')
    .update({ full_name: fullName, title, updated_at: new Date().toISOString() })
    .eq('id', userId)
  if (error) return { error: error.message }

  revalidatePath('/team')
  return { ok: true }
}

/**
 * Owner-only: set the per-user area access list. Pass `null` to clear the
 * restriction (the user falls back to their role defaults). Any unknown hrefs
 * are dropped so only real areas are ever stored.
 */
export async function setUserAreaAccess(userId: string, hrefs: string[] | null): Promise<Result> {
  try {
    await assertOwner()
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  let value: string[] | null = null
  if (hrefs !== null) {
    const valid = new Set(AREAS.map((a) => a.href))
    value = Array.from(new Set(hrefs.filter((h) => valid.has(h))))
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('profiles')
    .update({ area_access: value, updated_at: new Date().toISOString() })
    .eq('id', userId)
  if (error) return { error: error.message }

  revalidatePath('/team')
  revalidatePath('/', 'layout')
  return { ok: true }
}

/** Owner-only: activate or deactivate a member's account. */
export async function setUserStatus(userId: string, status: UserStatus): Promise<Result> {
  try {
    await assertOwner()
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  if (status === 'inactive') {
    if (user.id === userId) return { error: 'No puedes desactivar tu propia cuenta.' }

    const { data: target } = await supabase
      .from('profiles')
      .select('id, status, role')
      .eq('id', userId)
      .single()
    if (target?.role === 'owner') {
      const { count } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'owner')
        .eq('status', 'active')
      if ((count ?? 0) <= 1) return { error: 'No puedes desactivar al último Owner activo.' }
    }
  }

  const { error } = await supabase
    .from('profiles')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', userId)
  if (error) return { error: error.message }

  revalidatePath('/team')
  return { ok: true }
}
