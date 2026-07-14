import {
  Sun,
  Home,
  Users,
  Calendar,
  BarChart3,
  Gauge,
  ClipboardCheck,
  CheckCircle2,
  Zap,
  Globe,
  Film,
  UserSquare2,
  Camera,
  Clapperboard,
  Send,
  KanbanSquare,
  CalendarClock,
  Rocket,
  Lightbulb,
  Settings,
  UserCog,
  FileBarChart,
  Activity,
  type LucideIcon,
} from 'lucide-react'
import { hasPermission, type Permission } from '@/lib/auth/permissions'
import {
  AREAS,
  ALWAYS_ALLOWED_PREFIXES,
  effectiveAreaHrefs,
  NAV_GROUPS,
  type NavGroup,
} from '@/lib/auth/areas'
import type { UserRole } from '@/lib/supabase/types'

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  /** Hide this item from the sidebar when the current user lacks this permission. */
  permission?: Permission
  /** Sidebar section. Absent for the pinned top items (Mi día, Inicio). */
  group?: NavGroup
}

export { NAV_GROUPS, type NavGroup }

/** Icon per area href. AREAS (lib/auth/areas.ts) is the single source of truth for
 * the destinations themselves; the sidebar just attaches an icon to each. */
const ICON_BY_HREF: Record<string, LucideIcon> = {
  '/mi-dia': Sun,
  '/home': Home,
  '/runway': Rocket,
  '/idea-lab': Lightbulb,
  '/ideas-aprobadas': CheckCircle2,
  '/pipeline': KanbanSquare,
  '/video-reviews': Film,
  '/posting': Send,
  '/team': UserSquare2,
  '/produccion': Clapperboard,
  '/recording-calendar': Camera,
  '/clients': Users,
  '/clients/cadence': CalendarClock,
  '/calendar': Calendar,
  '/performance': BarChart3,
  '/reportes': FileBarChart,
  '/efficiency': Gauge,
  '/published': Globe,
  '/schedule-check': ClipboardCheck,
  '/automation': Zap,
  '/actividad': Activity,
  '/settings/users': UserCog,
  '/settings/workflow': Settings,
  '/settings/metricool': Globe,
}

export const navItems: NavItem[] = [
  // The landing: what each person has to do today. First, always, for everyone.
  { href: '/mi-dia', label: 'Mi día', icon: Sun },
  { href: '/home', label: 'Inicio', icon: Home },
  ...AREAS.filter((a) => a.nav !== false).map((a) => ({
    href: a.href,
    label: a.label,
    group: a.group,
    icon: ICON_BY_HREF[a.href] ?? Home,
    permission: a.permission,
  })),
]

/**
 * Nav items the user may see. `/home` is always shown; otherwise the user must
 * be able to reach the area. With no `areaAccess` argument this stays a pure
 * role filter (backwards-compatible). When `areaAccess` is provided it honors
 * the per-user admin grant (null grant → role defaults; owners see everything).
 */
export function visibleNavItems(
  role: UserRole | null | undefined,
  areaAccess?: string[] | null,
): NavItem[] {
  if (areaAccess === undefined) {
    return navItems.filter((n) => !n.permission || hasPermission(role, n.permission))
  }
  const reachable = effectiveAreaHrefs(role, areaAccess)
  // Always-allowed destinations aren't in AREAS (there's nothing to authorize),
  // so they'd never be "reachable" and would vanish from the sidebar. This used
  // to hardcode '/home'; the moment '/mi-dia' was added it disappeared for
  // everyone — owner included. Read the list instead of naming routes here.
  return navItems.filter(
    (n) => ALWAYS_ALLOWED_PREFIXES.includes(n.href) || reachable.has(n.href),
  )
}
