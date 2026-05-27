'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { navItems } from './nav-items'
import { Zap } from 'lucide-react'

interface SidebarProps {
  overdueCount?: number
  requestsCount?: number
  videoReviewCount?: number
}

export function Sidebar({ overdueCount = 0, requestsCount = 0, videoReviewCount = 0 }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside className="hidden lg:flex h-screen w-60 flex-col border-r border-border bg-card fixed top-0 left-0 z-30">
      {/* Logo */}
      <div className="flex items-center gap-2 px-6 py-5 border-b border-border">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <Zap className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="font-bold text-lg tracking-tight">NMedia</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          const badge =
            item.href === '/operations' && overdueCount > 0 ? overdueCount
            : item.href === '/inbox' && requestsCount > 0 ? requestsCount
            : item.href === '/video-reviews' && videoReviewCount > 0 ? videoReviewCount
            : 0
          const badgeColor =
            item.href === '/operations' ? 'bg-red-500'
            : item.href === '/video-reviews' ? 'bg-orange-500'
            : 'bg-blue-500'
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
              {badge > 0 && (
                <span className={cn('ml-auto text-[10px] font-bold text-white rounded-full px-1.5 py-0.5 leading-none min-w-[18px] text-center', badgeColor)}>
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-border">
        <p className="text-xs text-muted-foreground text-center">NMedia PR</p>
      </div>
    </aside>
  )
}
