import type { UserRole } from '@/lib/supabase/types'

export const ROLE_PREVIEW_COOKIE = 'nate_media_role_preview'

export const ROLE_PREVIEW_TARGETS = ['supervisor', 'editor', 'video', 'team_member'] as const

export type RolePreviewTarget = (typeof ROLE_PREVIEW_TARGETS)[number]

export function isRolePreviewTarget(value: unknown): value is RolePreviewTarget {
  return typeof value === 'string' && ROLE_PREVIEW_TARGETS.includes(value as RolePreviewTarget)
}

export function resolveRolePreview(
  actualRole: UserRole | null | undefined,
  requestedRole: string | null | undefined,
  isProduction: boolean,
): UserRole | null {
  if (isProduction || actualRole !== 'owner' || !isRolePreviewTarget(requestedRole)) {
    return null
  }

  return requestedRole
}
