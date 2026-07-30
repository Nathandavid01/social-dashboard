import { hasPermission, type Permission } from './permissions'
import type { UserRole } from '@/lib/supabase/types'

/**
 * Canonical catalogue of app "areas" (top-level destinations the admin can grant
 * per-user). Kept free of any React / lucide-icon imports so it is safe to use
 * from the Edge middleware as well as server/client code. `nav-items.ts` imports
 * this list and attaches an icon to each href.
 *
 * Per-user access model (admin-controlled, independent of role):
 *   - `area_access === null`  → no per-user restriction; fall back to the role's
 *      default permission gates (backwards-compatible with pre-feature accounts).
 *   - `area_access` is a list → the user may ONLY reach those areas, regardless
 *      of role. Owners always bypass restrictions (anti-lockout).
 * Within a reachable area the role still governs individual actions.
 */
export interface Area {
  href: string
  label: string
  /** Role permission that the area maps to (its "read" gate). */
  permission?: Permission
  /** Show in the sidebar nav. Defaults to true; false = gated/manageable but
   * reached only via deep links (e.g. /inbox, /alerts), not the sidebar. */
  nav?: boolean
  /** Sidebar section. A flat list of 20+ destinations is a wall, not a menu —
   * grouping is what makes it scannable. See NAV_GROUPS for the order. */
  group?: NavGroup
}

/**
 * Las secciones del menú, en orden. Nombradas por lo que la persona intenta
 * HACER, no por cómo está construida la app.
 *
 * Trabajo    — el flujo del editor: entregar y revisar, luego copy y publicar.
 * Marketing  — de dónde salen las ideas.
 * Recordings — el día de rodaje.
 * Desarrollo — lo anterior a este flujo (Pipeline, Producción, Video QC) más
 *              Runway. Sigue vivo, pero no es por donde entra el trabajo nuevo.
 */
export const NAV_GROUPS = [
  'Trabajo',
  'Marketing',
  'Recordings',
  'Clientes',
  'Publicación',
  'Métricas',
  'Desarrollo',
  'Equipo',
] as const

export type NavGroup = (typeof NAV_GROUPS)[number]

/** Restricted areas. `/mi-dia` and `/home` are intentionally excluded — everyone
 * lands there and `/mi-dia` only ever shows a person their OWN work. */
export const AREAS: Area[] = [
  // ── Trabajo: el flujo de un video, de la cámara a la aprobación ──
  // El flujo del editor va en dos pantallas: entrega y revisión en /revision,
  // copy y publicación en /entregas. Cruzan al aprobar el video.
  { href: '/revision',           label: 'Revisión',        permission: 'revision.read',      group: 'Trabajo' },
  { href: '/entregas',           label: 'Entregas',        permission: 'entregas.read',      group: 'Trabajo' },
  { href: '/pipeline',           label: 'Pipeline',        permission: 'planning.read',      group: 'Desarrollo' },
  { href: '/produccion',         label: 'Producción',      permission: 'production.read',    group: 'Desarrollo' },
  { href: '/video-reviews',      label: 'Video QC',        permission: 'video_reviews.read', group: 'Desarrollo' },
  { href: '/recording-calendar', label: 'Grabación',       permission: 'recording.read',     group: 'Recordings' },
  // Lista de grabación para marcar en el sitio. Va junto a Grabación porque
  // trabaja sobre las sesiones de ese calendario.
  { href: '/onsite',             label: 'On Site',         permission: 'recording.read',     group: 'Recordings' },

  // ── Ideas: qué vamos a grabar ──
  // Escribir el lote a mano — reemplaza el documento PDF.
  { href: '/escribir-ideas',     label: 'Escribir ideas',  permission: 'ideas.edit',         group: 'Marketing' },
  { href: '/idea-lab',           label: 'Lab de Ideas',    permission: 'ideas.edit',         group: 'Marketing' },
  { href: '/ideas-aprobadas',    label: 'Ideas Aprobadas', permission: 'ideas.read',         group: 'Marketing' },
  { href: '/runway',             label: 'Runway',          permission: 'runway.read',        group: 'Desarrollo' },

  // ── Publicación: sacarlo a la calle y comprobar que salió ──
  { href: '/posting',            label: 'Posting',         permission: 'posting.read',       group: 'Publicación' },
  { href: '/published',          label: 'Publicados',      permission: 'metricool.read',     group: 'Publicación' },
  { href: '/schedule-check',     label: 'Verificación',    permission: 'tasks.read.all',     group: 'Publicación' },
  { href: '/automation',         label: 'Automatización',  permission: 'automation.read',    group: 'Publicación' },

  // ── Clientes ──
  { href: '/clients',            label: 'Clientes',        permission: 'clients.read',       group: 'Clientes' },
  { href: '/clients/cadence',    label: 'Cadencia',        permission: 'clients.read',       group: 'Clientes' },
  // Reparto de la cartera a editor y diseñador, todos en una pantalla.
  { href: '/clients/asignaciones', label: 'Asignaciones',  permission: 'clients.edit',       group: 'Clientes' },
  // Was ungated: any role could reach it. It shows every client's schedule, so it
  // belongs behind the same gate as the clients list.
  { href: '/calendar',           label: 'Calendario de Contenido', permission: 'clients.read',   group: 'Clientes' },

  // ── Métricas ──
  { href: '/reportes',           label: 'Reportes',        permission: 'metricool.read',     group: 'Métricas' },
  { href: '/performance',        label: 'Rendimiento',     permission: 'performance.read',   group: 'Métricas' },
  { href: '/efficiency',         label: 'Eficiencia',      permission: 'efficiency.read',    group: 'Métricas' },

  // ── Equipo y ajustes ──
  { href: '/team',               label: 'Equipo',          permission: 'team.read',          group: 'Equipo' },
  { href: '/actividad',          label: 'Actividad',       permission: 'activity.read',      group: 'Equipo' },
  { href: '/settings/users',     label: 'Usuarios',        permission: 'team.assign_roles',  group: 'Equipo' },
  { href: '/settings/workflow',  label: 'Configuración',   permission: 'settings.edit',      group: 'Equipo' },
  // Was reachable by ANY authenticated user: it wasn't in AREAS at all, so
  // `areaForPath` returned null and `canAccessPath` waved it through.
  //
  // Gated on `metricool.read`, NOT `settings.edit` (owner-only): this page is
  // where the Metricool credentials get seeded into the browser's localStorage,
  // and /schedule-check + /published read them from there. Owner-only would trap
  // every supervisor on a fresh browser in a loop — Verificación says "ve a
  // Metricool" and Metricool bounces them to /home.
  { href: '/settings/metricool', label: 'Metricool',       permission: 'metricool.read',     group: 'Equipo' },
  // Reached via deep links (notifications, home cards, command palette), not the
  // sidebar — gated and manageable all the same. No permission = open by role
  // default (preserves their current ungated behavior); restrictable per-user.
  { href: '/inbox',              label: 'Bandeja',         nav: false },
  { href: '/alerts',             label: 'Alertas',         nav: false },
  { href: '/operations',         label: 'Operaciones',     nav: false },
  { href: '/planning',           label: 'Planificación',   nav: false },
]

/** Prefixes every authenticated user can always reach, never restrictable. */
export const ALWAYS_ALLOWED_PREFIXES = ['/mi-dia', '/home', '/changelog', '/pending']

function matchesPrefix(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + '/')
}

/** The most specific (longest-href) area that owns this path, or null. */
export function areaForPath(pathname: string): Area | null {
  let best: Area | null = null
  for (const area of AREAS) {
    if (matchesPrefix(pathname, area.href)) {
      if (!best || area.href.length > best.href.length) best = area
    }
  }
  return best
}

/**
 * The set of area hrefs a user can actually reach. Owners get everything;
 * a null grant uses role defaults; an explicit grant wins over the role.
 */
export function effectiveAreaHrefs(
  role: UserRole | null | undefined,
  areaAccess: string[] | null | undefined,
): Set<string> {
  if (role === 'owner') return new Set(AREAS.map((a) => a.href))
  if (areaAccess == null) {
    return new Set(AREAS.filter((a) => !a.permission || hasPermission(role, a.permission)).map((a) => a.href))
  }
  const granted = new Set(AREAS.map((a) => a.href))
  return new Set(areaAccess.filter((h) => granted.has(h)))
}

/** Whether the user may load the given path. */
export function canAccessPath(
  pathname: string,
  role: UserRole | null | undefined,
  areaAccess: string[] | null | undefined,
): boolean {
  if (ALWAYS_ALLOWED_PREFIXES.some((p) => matchesPrefix(pathname, p))) return true
  const area = areaForPath(pathname)
  if (!area) return true // unknown route (api, essentials) — not area-gated here
  return effectiveAreaHrefs(role, areaAccess).has(area.href)
}

/**
 * Whether an explicit per-user area grant should be treated as also granting the
 * given read permission (so a page that gates on it doesn't 500 for an off-role
 * user the admin deliberately let in). Only applies to non-null grants — a null
 * grant defers entirely to the role-based check.
 */
export function areaGrantsPermission(
  perm: Permission,
  role: UserRole | null | undefined,
  areaAccess: string[] | null | undefined,
): boolean {
  if (areaAccess == null) return false
  const reachable = effectiveAreaHrefs(role, areaAccess)
  return AREAS.some((a) => a.permission === perm && reachable.has(a.href))
}

/**
 * Drop any stored hrefs that no longer match a registered area (e.g. a feature
 * that was deleted) and de-duplicate, so removed features fall out of a user's
 * grant automatically. `null` (no restriction) is preserved as-is.
 */
export function normalizeAreaAccess(areaAccess: string[] | null | undefined): string[] | null {
  if (areaAccess == null) return null
  const valid = new Set(AREAS.map((a) => a.href))
  return Array.from(new Set(areaAccess.filter((h) => valid.has(h))))
}
