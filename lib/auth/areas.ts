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
}

/** Restricted areas. `/home` is intentionally excluded — it's the mandatory landing. */
export const AREAS: Area[] = [
  { href: '/runway',             label: 'Runway',          permission: 'runway.read' },
  { href: '/idea-lab',           label: 'Lab de Ideas',    permission: 'ideas.edit' },
  { href: '/ideas-aprobadas',    label: 'Ideas Aprobadas', permission: 'ideas.read' },
  { href: '/pipeline',           label: 'Pipeline',        permission: 'planning.read' },
  { href: '/video-reviews',      label: 'Video QC',        permission: 'video_reviews.read' },
  { href: '/posting',            label: 'Posting',         permission: 'posting.read' },
  { href: '/team',               label: 'Equipo',          permission: 'team.read' },
  { href: '/produccion',         label: 'Producción',      permission: 'production.read' },
  { href: '/recording-calendar', label: 'Grabación',       permission: 'recording.read' },
  { href: '/clients',            label: 'Clientes',        permission: 'clients.read' },
  { href: '/clients/cadence',    label: 'Cadencia',        permission: 'clients.read' },
  { href: '/calendar',           label: 'Calendario' },
  { href: '/performance',        label: 'Rendimiento',     permission: 'performance.read' },
  { href: '/efficiency',         label: 'Eficiencia',      permission: 'efficiency.read' },
  { href: '/published',          label: 'Publicados',      permission: 'metricool.read' },
  { href: '/schedule-check',     label: 'Verificación',    permission: 'tasks.read.all' },
  { href: '/automation',         label: 'Automatización',  permission: 'automation.read' },
  { href: '/settings/workflow',  label: 'Configuración',   permission: 'settings.edit' },
]

/** Prefixes every authenticated user can always reach, never restrictable. */
export const ALWAYS_ALLOWED_PREFIXES = ['/home', '/changelog', '/pending']

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
