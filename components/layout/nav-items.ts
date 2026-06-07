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
import type { UserRole } from '@/lib/supabase/types'

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  /** Hide this item from the sidebar when the current user lacks this permission. */
  permission?: Permission
}

export const navItems: NavItem[] = [
  { href: '/home',                label: 'Inicio',          icon: Home },
  { href: '/runway',              label: 'Runway',          icon: Rocket,          permission: 'runway.read' },
  { href: '/idea-lab',            label: 'Lab de Ideas',    icon: Lightbulb,       permission: 'ideas.edit' },
  { href: '/ideas-aprobadas',     label: 'Ideas Aprobadas', icon: CheckCircle2,    permission: 'ideas.read' },
  { href: '/pipeline',            label: 'Pipeline',        icon: KanbanSquare,    permission: 'planning.read' },
  { href: '/video-reviews',       label: 'Video QC',        icon: Film,            permission: 'video_reviews.read' },
  { href: '/posting',             label: 'Posting',         icon: Send,            permission: 'posting.read' },
  { href: '/team',                label: 'Equipo',          icon: UserSquare2,     permission: 'team.read' },
  { href: '/produccion',          label: 'Producción',      icon: Clapperboard,    permission: 'production.read' },
  { href: '/recording-calendar',  label: 'Grabación',       icon: Camera,          permission: 'recording.read' },
  { href: '/clients',             label: 'Clientes',        icon: Users,           permission: 'clients.read' },
  { href: '/clients/cadence',     label: 'Cadencia',        icon: CalendarClock,   permission: 'clients.read' },
  { href: '/calendar',            label: 'Calendario',      icon: Calendar },
  { href: '/performance',         label: 'Rendimiento',     icon: BarChart3,       permission: 'performance.read' },
  { href: '/efficiency',          label: 'Eficiencia',      icon: Gauge,           permission: 'efficiency.read' },
  { href: '/published',           label: 'Publicados',      icon: Globe,           permission: 'metricool.read' },
  { href: '/schedule-check',      label: 'Verificación',    icon: ClipboardCheck,  permission: 'tasks.read.all' },
  { href: '/automation',          label: 'Automatización',  icon: Zap,             permission: 'automation.read' },
  { href: '/settings/workflow',   label: 'Configuración',   icon: Settings,        permission: 'settings.edit' },
]

/**
 * Nav items the given role may see: an item shows when it has no `permission`
 * gate, or the role satisfies it (owner satisfies everything). Used by the
 * sidebar to hide routes the role can't access.
 */
export function visibleNavItems(role: UserRole | null | undefined): NavItem[] {
  return navItems.filter((n) => !n.permission || hasPermission(role, n.permission))
}
