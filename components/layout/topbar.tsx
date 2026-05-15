import { MobileNav } from './mobile-nav'
import { ThemeToggle } from '@/components/shared/theme-toggle'
import { UserMenu } from '@/components/auth/user-menu'

export function Topbar() {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-4 border-b border-border bg-background/95 backdrop-blur px-4 lg:px-6">
      <MobileNav />
      <div className="flex-1" />
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  )
}
