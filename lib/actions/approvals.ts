'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertOwner } from '@/lib/auth/server'
import { validateApprovalRole } from '@/lib/utils/approval-core'
import type { Profile, UserRole } from '@/lib/supabase/types'

type Result = { ok?: true; error?: string }

/** Owner-only: list every account waiting for approval (newest signup first). */
export async function getPendingApprovals(): Promise<Profile[]> {
  try {
    await assertOwner()
  } catch {
    return []
  }
  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('approval_status', 'pending')
    .order('created_at', { ascending: false })
  return (data as Profile[] | null) ?? []
}

/** Owner-only: how many accounts are awaiting approval (for the nav badge). */
export async function getPendingApprovalCount(): Promise<number> {
  try {
    await assertOwner()
  } catch {
    return 0
  }
  const supabase = await createClient()
  const { count } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('approval_status', 'pending')
  return count ?? 0
}

/**
 * Owner-only: approve a pending signup, assigning their working role. Marks the
 * profile approved + active and notifies the new user so they know they're in.
 */
export async function approveUser(userId: string, role: UserRole): Promise<Result> {
  try {
    await assertOwner()
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  const validRole = validateApprovalRole(role)
  if (!validRole.ok) return { error: validRole.error }

  const supabase = await createClient()
  const { error } = await supabase
    .from('profiles')
    .update({
      approval_status: 'approved',
      role,
      status: 'active',
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .eq('approval_status', 'pending')
  if (error) return { error: error.message }

  // Let the newly approved user know (best-effort — never block on this).
  await supabase.from('notifications').insert({
    user_id: userId,
    kind: 'system',
    title: 'Tu cuenta fue aprobada',
    body: 'Ya tienes acceso al dashboard de Nate Media. ¡Bienvenido!',
    link: '/pipeline',
    severity: 'success',
    meta: {},
  })

  revalidatePath('/team')
  revalidatePath('/team/approvals')
  return { ok: true }
}

/**
 * Owner-only: reject a pending signup. Marks the profile rejected + inactive so
 * the dashboard guard signs them out on their next request.
 */
export async function rejectUser(userId: string): Promise<Result> {
  try {
    await assertOwner()
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user?.id === userId) return { error: 'No puedes rechazar tu propia cuenta.' }

  const { error } = await supabase
    .from('profiles')
    .update({
      approval_status: 'rejected',
      status: 'inactive',
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
  if (error) return { error: error.message }

  revalidatePath('/team')
  revalidatePath('/team/approvals')
  return { ok: true }
}

/**
 * Notify every owner that a new account is waiting for approval. Runs with the
 * service-role client because the signup is still authenticated as the pending
 * user (RLS would block writing notifications for someone else). Best-effort.
 */
export async function notifyOwnersOfSignup(newUser: { id: string; fullName: string; email: string }): Promise<void> {
  const admin = createAdminClient()
  if (!admin) return

  const { data: owners } = await admin
    .from('profiles')
    .select('id')
    .eq('role', 'owner')
    .eq('status', 'active')
  if (!owners?.length) return

  const rows = owners.map((o: { id: string }) => ({
    user_id: o.id,
    kind: 'system',
    title: 'Nueva cuenta pendiente de aprobación',
    body: `${newUser.fullName || newUser.email} solicitó acceso al dashboard.`,
    link: '/team/approvals',
    severity: 'info',
    meta: { pendingUserId: newUser.id },
  }))
  await admin.from('notifications').insert(rows)
}
