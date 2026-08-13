'use client'

import { AuthProvider } from '@/lib/context/auth-context'
import { SidebarProvider } from '@/lib/context/sidebar-context'
import { UiEventTracker } from '@/components/activity/ui-event-tracker'
import type { Profile, UserRole } from '@/lib/supabase/types'

interface Props {
  children: React.ReactNode
  user: { id: string; email: string } | null
  profile: Profile | null
  role: UserRole | null
}

export function DashboardProviders({ children, user, profile, role }: Props) {
  return (
    <AuthProvider value={{ user, profile, role }}>
      <SidebarProvider>
        {user ? <UiEventTracker /> : null}
        {children}
      </SidebarProvider>
    </AuthProvider>
  )
}
