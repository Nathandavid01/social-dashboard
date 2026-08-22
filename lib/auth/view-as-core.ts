import type { UserRole } from '@/lib/supabase/types'

/** Cookie httpOnly: id del editor cuya cartera está viendo un admin. */
export const VIEW_AS_COOKIE = 'nm_view_as_editor'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isViewAsEditorId(value: string | null | undefined): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}

/** Owner y supervisor pueden entrar a la vista de un editor. */
export function canStartViewAs(role: UserRole | null | undefined): boolean {
  return role === 'owner' || role === 'supervisor'
}

export function viewAsTargetOk(profile: {
  role: string
  status: string
  approval_status?: string | null
} | null): boolean {
  if (!profile) return false
  const approval = profile.approval_status ?? 'approved'
  return profile.role === 'editor' && profile.status === 'active' && approval === 'approved'
}

/** Rol para menú, permisos de pantalla y filtro de clientes. */
export function resolveEffectiveRole(
  realRole: UserRole | null | undefined,
  viewAsEditorId: string | null | undefined,
): UserRole | null {
  if (!realRole) return null
  if (canStartViewAs(realRole) && isViewAsEditorId(viewAsEditorId)) return 'editor'
  return realRole
}

/** Id usado para `assigned_to` cuando el admin mira como un editor. */
export function resolveEffectiveUserId(
  realUserId: string | null | undefined,
  realRole: UserRole | null | undefined,
  viewAsEditorId: string | null | undefined,
): string | null {
  if (canStartViewAs(realRole) && isViewAsEditorId(viewAsEditorId)) return viewAsEditorId
  return realUserId ?? null
}
