'use client'

import { MobileNav } from './mobile-nav'
import { UserMenu } from '@/components/auth/user-menu'
import { NotificationBell } from '@/components/notifications/notification-bell'
import { PresenceBar } from '@/components/presence/presence-bar'
import type { Notification } from '@/lib/supabase/types'

interface TopbarProps {
  videoReviewCount?: number
  notifications?: Notification[]
  unreadCount?: number
  currentUser: { id: string; full_name: string | null; avatar_url: string | null } | null
}

export function Topbar({
  videoReviewCount = 0,
  notifications = [],
  unreadCount = 0,
  currentUser,
}: TopbarProps) {
  return (
    <header
      data-testid="app-topbar"
      className="sticky top-0 z-40 shrink-0 overflow-visible border-b border-border bg-background/95 backdrop-blur pt-[env(safe-area-inset-top)]"
    >
      {/* Inner row keeps a full 56px tap strip below the PWA/notch safe area. */}
      <div className="flex h-14 items-center gap-2 pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] lg:gap-4 lg:pl-6 lg:pr-6">
        {/* Sandwich/hamburger must never flex-shrink under presence / actions on narrow PWA viewports. */}
        <div className="relative z-40 shrink-0">
          <MobileNav videoReviewCount={videoReviewCount} />
        </div>
        {/* Presence is secondary on phones — hide below sm so it cannot crowd the menu. */}
        {currentUser && (
          <div className="hidden min-w-0 sm:block">
            <PresenceBar currentUser={currentUser} />
          </div>
        )}
        <div className="min-w-0 flex-1" />
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {currentUser && (
            <NotificationBell userId={currentUser.id} initialNotifications={notifications} initialUnreadCount={unreadCount} />
          )}
          <UserMenu />
        </div>
      </div>
    </header>
  )
}
