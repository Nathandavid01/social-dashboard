import { ASSIGNABLE_ROLES } from '@/lib/auth/permissions'
import type { Profile, UserRole } from '@/lib/supabase/types'

/**
 * Pure, Supabase-free helpers for the account-approval workflow. Self-signups
 * start as `approval_status: 'pending'` and only reach the dashboard once an
 * owner approves them. Keeping the decisions here makes the guard and the admin
 * table unit-testable without a database.
 */

type ProfileLike = Pick<Profile, 'approval_status'> | null | undefined

export function isApproved(profile: ProfileLike): boolean {
  return profile?.approval_status === 'approved'
}

export function isPending(profile: ProfileLike): boolean {
  return profile?.approval_status === 'pending'
}

/** Pending profiles only, newest signup first (so the owner reviews the freshest). */
export function filterPendingApprovals<T extends Pick<Profile, 'approval_status' | 'created_at'>>(
  profiles: T[],
): T[] {
  return profiles
    .filter((p) => p.approval_status === 'pending')
    .sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0))
}

/**
 * Where an authenticated user should be sent based on their approval status.
 * `null` means "let them through". Used by the dashboard layout guard.
 */
export function resolveApprovalRedirect(profile: ProfileLike): string | null {
  if (!profile) return null
  switch (profile.approval_status) {
    case 'approved':
      return null
    case 'rejected':
      return '/login?rejected=1'
    case 'pending':
    default:
      return '/pending'
  }
}

export type ApprovalRoleValidation = { ok: true } | { ok: false; error: string }

/** An owner approving a signup must assign a real, assignable role (not legacy). */
export function validateApprovalRole(role: UserRole | undefined): ApprovalRoleValidation {
  if (!role || !ASSIGNABLE_ROLES.includes(role)) {
    return { ok: false, error: 'Elige un rol válido para aprobar al usuario.' }
  }
  return { ok: true }
}
