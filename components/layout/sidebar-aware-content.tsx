'use client'

import { useSidebar } from '@/lib/context/sidebar-context'
import { cn } from '@/lib/utils'

/** Main content column. Its left margin tracks the (collapsible) sidebar width. */
export function SidebarAwareContent({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar()
  return (
    <div
      className={cn(
        'flex min-w-0 flex-1 flex-col transition-[margin] duration-200',
        collapsed ? 'lg:ml-16' : 'lg:ml-60',
      )}
    >
      {children}
    </div>
  )
}
