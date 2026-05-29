'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { assertOwner } from '@/lib/auth/server'
import type { UserStatus } from '@/lib/supabase/types'

type Result = { ok?: true; error?: string }

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
