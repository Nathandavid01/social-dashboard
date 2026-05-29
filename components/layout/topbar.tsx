'use client'

import { MobileNav } from './mobile-nav'
import { ThemeToggle } from '@/components/shared/theme-toggle'
import { UserMenu } from '@/components/auth/user-menu'
import { NotificationBell } from '@/components/notifications/notification-bell'
import { PresenceBar } from '@/components/presence/presence-bar'
import { Search } from 'lucide-react'
import type { Notification, Profile } from '@/lib/supabase/types'

interface TopbarProps {
  overdueCount?: number
  requestsCount?: number
  videoReviewCount?: number
  notifications: Notification[]
  unreadCount: number
  currentUser: { id: string; full_name: string | null; avatar_url: string | null } | null
}

export function Topbar({
  overdueCount = 0,
  requestsCount = 0,
  videoReviewCount = 0,
  notifications,
  unreadCount,
  currentUser,
}: TopbarProps) {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-4 border-b border-border bg-background/95 backdrop-blur px-4 lg:px-6">
      <MobileNav overdueCount={overdueCount} requestsCount={requestsCount} videoReviewCount={videoReviewCount} />
      {currentUser && <PresenceBar currentUser={currentUser} />}
      <div className="flex-1" />
      <div className="flex items-center gap-2">
        <button
          onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', metaKey: true, bubbles: true }))}
          className="hidden sm:flex h-8 items-center gap-2 rounded-md border border-input bg-muted/50 px-3 text-xs text-muted-foreground hover:bg-muted transition-colors"
          title="Buscar"
        >
          <Search className="h-3.5 w-3.5" />
          <span>Buscar...</span>
        </button>
        {currentUser && (
          <NotificationBell
            initialNotifications={notifications}
            initialUnreadCount={unreadCount}
            userId={currentUser.id}
          />
        )}
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  )
}
