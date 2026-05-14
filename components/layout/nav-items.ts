import {
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
  { href: '/operations', label: 'Operations', icon: LayoutDashboard },
  { href: '/clients', label: 'Clients', icon: Users },
  { href: '/calendar', label: 'Calendar', icon: Calendar },
  { href: '/alerts', label: 'Alerts', icon: Bell },
  { href: '/performance', label: 'Performance', icon: BarChart3 },
  { href: '/efficiency', label: 'Efficiency', icon: Gauge },
  { href: '/captions', label: 'Captions', icon: MessageSquareText },
  { href: '/metricool', label: 'Metricool', icon: Activity },
  { href: '/schedule-check', label: 'Verificacion', icon: ClipboardCheck },
  { href: '/automation', label: 'Automation', icon: Zap },
]
