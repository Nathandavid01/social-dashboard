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
  | 'operations.overview'
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
  | 'video.discard'
  | 'production.read'
  | 'production.edit'
  // Calendar
  | 'recording.read'
  | 'recording.create'
  | 'recording.complete'
  /** Generar y editar el brief de On Site (admin / supervisor). */
  | 'recording.brief'
  // Posting
  | 'posting.read'
  | 'posting.publish'
  | 'captions.use'
  | 'captions.edit'
  /** Gráficas IA: generar artes con Grok Imagine usando la marca del cliente. */
  | 'graphics.generate'
  | 'graphics.cost.read'
  | 'metricool.read'
  | 'metricool.write'
  // Insights
  | 'performance.read'
  | 'efficiency.read'
  | 'weekly_compliance.read'
  | 'runway.read'
  | 'activity.read'
  | 'presence.read'
  | 'planning.read'
  | 'entregas.read'
  | 'revision.read'
  /** Paso 2: banco de crudos para que el editor baje y vea. */
  | 'pipeline.read'
  /** Banco de Video global (/banco): biblioteca de crudos + calendario proyectado. Solo admins. */
  | 'video_bank.read'
  | 'planning.act'
  | 'planning.assign'
  | 'planning.move'
  // Cadence (home posting-cadence widget, read-only)
  | 'cadence.read'
  // Team & admin
  | 'team.read'
  | 'team.assign_roles'
  | 'automation.read'
  | 'automation.edit'
  | 'settings.edit'
  | 'alerts.read'
  | 'alerts.dismiss'
  /** Subir o elegir la foto propia (todos los roles autenticados). */
  | 'profile.avatar'
  /** Ver la plataforma como un editor (solo owner/supervisor). */
  | 'view_as.editor'

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

  // Supervisor — manage team/content; can edit contracts; billing remains owner-only.
  supervisor: [
    'operations.overview',
    'clients.read', 'clients.create', 'clients.edit', 'clients.brand.edit',
    'clients.billing.read', 'clients.contract.read', 'clients.contract.edit', 'clients.assets.upload',
    'clients.sms.send',
    'tasks.read.all', 'tasks.create', 'tasks.edit', 'tasks.delete',
    'ideas.read', 'ideas.edit',
    'video_reviews.read', 'video_reviews.write', 'video.upload', 'video.approve', 'video.discard',
    'production.read', 'production.edit',
    'recording.read', 'recording.create', 'recording.complete', 'recording.brief',
    'posting.read', 'posting.publish', 'captions.use', 'captions.edit',
    'graphics.generate', 'graphics.cost.read',
    'metricool.read', 'metricool.write',
    'performance.read', 'efficiency.read',
    'weekly_compliance.read', 'runway.read', 'activity.read', 'presence.read',
    'planning.read', 'entregas.read', 'revision.read', 'pipeline.read', 'video_bank.read', 'planning.act', 'planning.assign', 'planning.move',
    // Reparte los roles de ejecución; owner y supervisor siguen siendo del
    // owner (lo impone canAssignRole, no esta lista).
    'team.assign_roles',
    'cadence.read',
    'team.read',
    'automation.read',
    'alerts.read', 'alerts.dismiss',
    'profile.avatar',
    'view_as.editor',
  ],

  // Editor — paso 2 (Pipeline: baja crudos asignados) y Revisión (corta).
  // No aprueba ni publica. Entregas (copy/publicar) no es su pantalla.
  editor: [
    'ideas.read',
    'video.upload',
    'captions.use', 'captions.edit',
    'revision.read', 'pipeline.read', 'planning.act',
    'presence.read',
    'alerts.read',
    'profile.avatar',
  ],

  // Videógrafo — grabación e ideas. No entra a Entregas: su trabajo termina
  // cuando el material está grabado; entregarlo editado es del editor.
  video: [
    'clients.read', 'clients.assets.upload',
    'tasks.read.own', 'tasks.edit',
    'ideas.read', 'ideas.edit',
    'runway.read',
    'video.upload',
    'recording.read', 'recording.create', 'recording.complete',
    'weekly_compliance.read', 'cadence.read', 'activity.read', 'presence.read',
    'alerts.read',
    'profile.avatar',
  ],

  // Diseñador — Ideas y Entregas. Sube piezas pero NO escribe el copy (sin
  // captions.*), ni aprueba, ni publica.
  disenador: [
    'ideas.read', 'ideas.edit',
    'graphics.generate',
    'runway.read',
    'video.upload',
    'revision.read',
    'presence.read',
    'alerts.read',
    'profile.avatar',
  ],

  // Copy — escribe el copy de lo aprobado. Ve el tablero entero para saber
  // qué viene y qué ya salió, pero no aprueba ni publica.
  copy: [
    'clients.read',
    'ideas.read',
    'entregas.read', 'revision.read',
    'captions.use', 'captions.edit',
    'metricool.read', 'posting.read',
    'cadence.read',
    'presence.read',
    'alerts.read',
    'profile.avatar',
  ],

  // Legacy default — treated as editor for backwards compatibility.
  team_member: [
    'clients.read', 'clients.brand.edit',
    'tasks.read.all', 'tasks.create', 'tasks.edit',
    'ideas.read', 'ideas.edit',
    'video_reviews.read',
    'pipeline.read',
    'production.read', 'production.edit',
    'recording.read',
    'posting.read', 'captions.use',
    'metricool.read',
    'planning.read',
    'presence.read',
    'alerts.read',
    'profile.avatar',
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
  disenador:   'Diseñador',
  copy:        'Copy',
  team_member: 'Team (legacy)',
}

export const ROLE_DESCRIPTION: Record<UserRole, string> = {
  owner:       'Acceso completo, incluyendo facturación, contratos y asignación de roles.',
  supervisor:  'Gestión de equipo y contenido. Edita contratos; ve facturación pero no la edita.',
  editor:      'Pipeline y Revisión: baja el crudo asignado y entrega el corte. No aprueba ni publica.',
  video:       'Grabación e ideas. No entra a Entregas.',
  disenador:   'Ideas y Entregas: sube piezas, sin escribir el copy.',
  copy:        'Escribe el copy de los videos aprobados. No aprueba ni publica.',
  team_member: 'Rol heredado — se trata como Editor.',
}

export const ASSIGNABLE_ROLES: UserRole[] = ['owner', 'supervisor', 'copy', 'editor', 'disenador', 'video']
