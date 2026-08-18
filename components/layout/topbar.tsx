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
    <header className="sticky top-0 z-20 flex h-14 items-center gap-4 border-b border-border bg-background/95 backdrop-blur px-4 lg:px-6">
      <MobileNav videoReviewCount={videoReviewCount} />
      {currentUser && <PresenceBar currentUser={currentUser} />}
      <div className="flex-1" />
      <div className="flex items-center gap-2">
        {currentUser && (
          <NotificationBell userId={currentUser.id} initialNotifications={notifications} initialUnreadCount={unreadCount} />
        )}
        <UserMenu />
      </div>
    </header>
  )
}
