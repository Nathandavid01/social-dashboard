import type { UserRole } from '@/lib/supabase/types'

/**
 * Permission catalogue. New features MUST register a permission here and gate
 * their access points (UI + server actions + page routes) with hasPermission()
 * or RoleGate. See CLAUDE.md.
 */
export type Permission =
  // Clients
  | 'clients.read'
  | 'clients.create'
  | 'clients.edit'
  | 'clients.delete'
  | 'clients.brand.edit'
  | 'clients.billing.read'
  | 'clients.billing.edit'
  | 'clients.contract.read'
  | 'clients.contract.edit'
  | 'clients.assets.upload'
  | 'clients.sms.send'
  // Tasks / operations
  | 'tasks.read.all'
  | 'tasks.read.own'
  | 'tasks.create'
  | 'tasks.edit'
  | 'tasks.delete'
  // Content & video
  | 'ideas.read'
  | 'ideas.edit'
  | 'video_reviews.read'
  | 'video_reviews.write'
  | 'video.upload'
  | 'video.approve'
  | 'production.read'
  | 'production.edit'
  // Calendar
  | 'recording.read'
  | 'recording.create'
  | 'recording.complete'
  // Posting
  | 'posting.read'
  | 'posting.publish'
  | 'captions.use'
  | 'captions.edit'
  | 'metricool.read'
  | 'metricool.write'
  // Insights
  | 'performance.read'
  | 'efficiency.read'
  | 'weekly_compliance.read'
  | 'runway.read'
  | 'activity.read'
  | 'planning.read'
  | 'planning.act'
  | 'planning.assign'
  | 'planning.move'
  | 'planning.intake'
  // Team & admin
  | 'team.read'
  | 'team.assign_roles'
  | 'automation.read'
  | 'automation.edit'
  | 'settings.edit'
  | 'alerts.read'
  | 'alerts.dismiss'

/**
 * Wildcard sentinel — present in a role's permission set means "everything".
 * Used to keep the owner row small and to allow future permissions without
 * having to touch this file every time.
 */
const ALL = '*' as const
type RolePerms = Permission[] | typeof ALL

const RBAC: Record<UserRole, RolePerms> = {
  // Owner — full control, including billing, contracts, role assignment.
  owner: ALL,

  // Supervisor — manage team, content, see (but not edit) billing/contracts.
  supervisor: [
    'clients.read', 'clients.create', 'clients.edit', 'clients.brand.edit',
    'clients.billing.read', 'clients.contract.read', 'clients.assets.upload',
    'clients.sms.send',
    'tasks.read.all', 'tasks.create', 'tasks.edit', 'tasks.delete',
    'ideas.read', 'ideas.edit',
    'video_reviews.read', 'video_reviews.write', 'video.upload', 'video.approve',
    'production.read', 'production.edit',
    'recording.read', 'recording.create', 'recording.complete',
    'posting.read', 'posting.publish', 'captions.use', 'captions.edit',
    'metricool.read', 'metricool.write',
    'performance.read', 'efficiency.read',
    'weekly_compliance.read', 'runway.read', 'activity.read',
    'planning.read', 'planning.act', 'planning.assign', 'planning.move', 'planning.intake',
    'team.read',
    'automation.read',
    'alerts.read', 'alerts.dismiss',
  ],

  // Editor — content + captions, no billing, no team management.
  editor: [
    'clients.read', 'clients.brand.edit', 'clients.assets.upload',
    'tasks.read.all', 'tasks.create', 'tasks.edit',
    'ideas.read', 'ideas.edit',
    'video_reviews.read', 'video.upload',
    'production.read', 'production.edit',
    'recording.read',
    'posting.read', 'captions.use', 'captions.edit',
    'metricool.read',
    'weekly_compliance.read', 'activity.read',
    'planning.read', 'planning.act', 'planning.move', 'planning.intake',
    'alerts.read',
  ],

  // Video / videógrafo — recording-focused, video upload + QC.
  video: [
    'clients.read', 'clients.assets.upload',
    'tasks.read.own', 'tasks.edit',
    'ideas.read',
    'video_reviews.read', 'video_reviews.write', 'video.upload',
    'production.read', 'production.edit',
    'recording.read', 'recording.create', 'recording.complete',
    'weekly_compliance.read', 'activity.read',
    'planning.read',
    'alerts.read',
  ],

  // Legacy default — treated as editor for backwards compatibility.
  team_member: [
    'clients.read', 'clients.brand.edit',
    'tasks.read.all', 'tasks.create', 'tasks.edit',
    'ideas.read', 'ideas.edit',
    'video_reviews.read',
    'production.read', 'production.edit',
    'recording.read',
    'posting.read', 'captions.use',
    'metricool.read',
    'planning.read',
    'alerts.read',
  ],
}

export function hasPermission(role: UserRole | null | undefined, perm: Permission): boolean {
  if (!role) return false
  const set = RBAC[role]
  if (set === ALL) return true
  return set.includes(perm)
}

export function hasAnyPermission(role: UserRole | null | undefined, perms: Permission[]): boolean {
  return perms.some((p) => hasPermission(role, p))
}

export const ROLE_LABEL: Record<UserRole, string> = {
  owner:       'Owner',
  supervisor:  'Supervisor',
  editor:      'Editor',
  video:       'Videógrafo',
  team_member: 'Team (legacy)',
}

export const ROLE_DESCRIPTION: Record<UserRole, string> = {
  owner:       'Acceso completo, incluyendo facturación, contratos y asignación de roles.',
  supervisor:  'Gestión de equipo y contenido. Ve facturación/contratos pero no los edita.',
  editor:      'Edición de contenido, captions y marca. Sin acceso a facturación.',
  video:       'Calendario de grabación, QC de video y subida de material. Sin edición de marca.',
  team_member: 'Rol heredado — se trata como Editor.',
}

export const ASSIGNABLE_ROLES: UserRole[] = ['owner', 'supervisor', 'editor', 'video']
