'use client'

import Link from 'next/link'
import { MobileNav } from './mobile-nav'
import { ThemeToggle } from '@/components/shared/theme-toggle'
import { UserMenu } from '@/components/auth/user-menu'
import { QuickTaskButton } from './quick-task-button'
import { KeyboardShortcutsHelp } from '@/components/shared/keyboard-shortcuts-help'
import { Bell, Search } from 'lucide-react'

interface TopbarProps {
  alertCount?: number
  overdueCount?: number
  requestsCount?: number
  videoReviewCount?: number
}

export function Topbar({ alertCount = 0, overdueCount = 0, requestsCount = 0, videoReviewCount = 0 }: TopbarProps) {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-4 border-b border-border bg-background/95 backdrop-blur px-4 lg:px-6">
      <MobileNav overdueCount={overdueCount} requestsCount={requestsCount} videoReviewCount={videoReviewCount} />
      <div className="flex-1" />
      <div className="flex items-center gap-2">
        <button
          onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', metaKey: true, bubbles: true }))}
          className="hidden sm:flex h-8 items-center gap-2 rounded-md border border-input bg-muted/50 px-3 text-xs text-muted-foreground hover:bg-muted transition-colors"
          title="Buscar (⌘P)"
        >
          <Search className="h-3.5 w-3.5" />
          <span>Buscar...</span>
          <kbd className="ml-1 text-[10px] bg-background rounded px-1">⌘P</kbd>
        </button>
        <KeyboardShortcutsHelp />
        <QuickTaskButton />
        <Link
          href="/alerts"
          className="relative flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted transition-colors"
          title="Alertas"
        >
          <Bell className="h-4 w-4" />
          {alertCount > 0 && (
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-[9px] text-white flex items-center justify-center font-bold leading-none">
              {alertCount > 9 ? '9+' : alertCount}
            </span>
          )}
        </Link>
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  )
}
