import {
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
  type LucideIcon,
} from 'lucide-react'
import { hasPermission, type Permission } from '@/lib/auth/permissions'
import { AREAS, effectiveAreaHrefs } from '@/lib/auth/areas'
import type { UserRole } from '@/lib/supabase/types'

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  /** Hide this item from the sidebar when the current user lacks this permission. */
  permission?: Permission
}

/** Icon per area href. AREAS (lib/auth/areas.ts) is the single source of truth for
 * the destinations themselves; the sidebar just attaches an icon to each. */
const ICON_BY_HREF: Record<string, LucideIcon> = {
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
  '/efficiency': Gauge,
  '/published': Globe,
  '/schedule-check': ClipboardCheck,
  '/automation': Zap,
  '/settings/workflow': Settings,
}

export const navItems: NavItem[] = [
  { href: '/home', label: 'Inicio', icon: Home },
  ...AREAS.map((a) => ({
    href: a.href,
    label: a.label,
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
  return navItems.filter((n) => n.href === '/home' || reachable.has(n.href))
}
