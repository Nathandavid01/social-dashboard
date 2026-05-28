import {
  Home,
  LayoutDashboard,
  Users,
  Bell,
  Calendar,
  BarChart3,
  MessageSquareText,
  Gauge,
  Activity,
  ClipboardCheck,
  Zap,
  Globe,
  Film,
  UserSquare2,
  Camera,
  Clapperboard,
  Send,
  Lightbulb,
  ListChecks,
  CalendarClock,
  Settings,
  type LucideIcon,
} from 'lucide-react'
import type { Permission } from '@/lib/auth/permissions'

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  /** Hide this item from the sidebar when the current user lacks this permission. */
  permission?: Permission
}

export const navItems: NavItem[] = [
  { href: '/home',                label: 'Inicio',          icon: Home },
  { href: '/planning',            label: 'Planning',        icon: ListChecks,      permission: 'planning.read' },
  { href: '/operations',          label: 'Operaciones',     icon: LayoutDashboard, permission: 'tasks.read.all' },
  { href: '/video-reviews',       label: 'Video QC',        icon: Film,            permission: 'video_reviews.read' },
  { href: '/posting',             label: 'Posting',         icon: Send,            permission: 'posting.read' },
  { href: '/team',                label: 'Equipo',          icon: UserSquare2,     permission: 'team.read' },
  { href: '/produccion',          label: 'Producción',      icon: Clapperboard,    permission: 'production.read' },
  { href: '/recording-calendar',  label: 'Grabación',       icon: Camera,          permission: 'recording.read' },
  { href: '/clients',             label: 'Clientes',        icon: Users,           permission: 'clients.read' },
  { href: '/clients/cadence',     label: 'Cadencia',        icon: CalendarClock,   permission: 'clients.read' },
  { href: '/calendar',            label: 'Calendario',      icon: Calendar },
  { href: '/alerts',              label: 'Alertas',         icon: Bell,            permission: 'alerts.read' },
  { href: '/performance',         label: 'Rendimiento',     icon: BarChart3,       permission: 'performance.read' },
  { href: '/efficiency',          label: 'Eficiencia',      icon: Gauge,           permission: 'efficiency.read' },
  { href: '/ideacion',            label: 'Ideación',        icon: Lightbulb,       permission: 'ideas.read' },
  { href: '/captions',            label: 'Captions',        icon: MessageSquareText, permission: 'captions.use' },
  { href: '/published',           label: 'Publicados',      icon: Globe,           permission: 'metricool.read' },
  { href: '/metricool',           label: 'Metricool',       icon: Activity,        permission: 'metricool.read' },
  { href: '/schedule-check',      label: 'Verificación',    icon: ClipboardCheck,  permission: 'tasks.read.all' },
  { href: '/automation',          label: 'Automatización',  icon: Zap,             permission: 'automation.read' },
  { href: '/settings/workflow',   label: 'Configuración',   icon: Settings,        permission: 'settings.edit' },
]
