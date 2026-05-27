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
  Inbox,
  Film,
  UserSquare2,
  Camera,
  Clapperboard,
  Send,
  Lightbulb,
  type LucideIcon,
} from 'lucide-react'
import type { UserRole } from '@/lib/supabase/types'

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  requiredRole?: UserRole
}

export const navItems: NavItem[] = [
  { href: '/home', label: 'Inicio', icon: Home },
  { href: '/operations', label: 'Operaciones', icon: LayoutDashboard },
  { href: '/inbox', label: 'Bandeja', icon: Inbox },
  { href: '/video-reviews', label: 'Video QC', icon: Film },
  { href: '/posting', label: 'Posting', icon: Send },
  { href: '/team', label: 'Equipo', icon: UserSquare2 },
  { href: '/produccion', label: 'Producción', icon: Clapperboard },
  { href: '/recording-calendar', label: 'Grabación', icon: Camera },
  { href: '/clients', label: 'Clientes', icon: Users },
  { href: '/calendar', label: 'Calendario', icon: Calendar },
  { href: '/alerts', label: 'Alertas', icon: Bell },
  { href: '/performance', label: 'Rendimiento', icon: BarChart3 },
  { href: '/efficiency', label: 'Eficiencia', icon: Gauge },
  { href: '/ideacion', label: 'Ideación', icon: Lightbulb },
  { href: '/captions', label: 'Captions', icon: MessageSquareText },
  { href: '/published', label: 'Publicados', icon: Globe },
  { href: '/metricool', label: 'Metricool', icon: Activity },
  { href: '/schedule-check', label: 'Verificación', icon: ClipboardCheck },
  { href: '/automation', label: 'Automatización', icon: Zap },
]
