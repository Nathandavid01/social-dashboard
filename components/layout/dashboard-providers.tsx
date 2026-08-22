'use client'

import { AuthProvider } from '@/lib/context/auth-context'
import { SidebarProvider } from '@/lib/context/sidebar-context'
import { UiEventTracker } from '@/components/activity/ui-event-tracker'
import { PresenceHeartbeat } from '@/components/activity/presence-heartbeat'
import type { Profile, UserRole } from '@/lib/supabase/types'
import type { ViewAsEditorOption } from '@/lib/context/auth-context'

interface Props {
  children: React.ReactNode
  user: { id: string; email: string } | null
  profile: Profile | null
  role: UserRole | null
  realRole?: UserRole | null
  viewAsEditor?: ViewAsEditorOption | null
  editors?: ViewAsEditorOption[]
}

export function DashboardProviders({
  children,
  user,
  profile,
  role,
  realRole = null,
  viewAsEditor = null,
  editors = [],
}: Props) {
  return (
    <AuthProvider value={{ user, profile, role, realRole, viewAsEditor, editors }}>
      <SidebarProvider>
        {user ? <UiEventTracker /> : null}
        {user ? <PresenceHeartbeat /> : null}
        {children}
      </SidebarProvider>
    </AuthProvider>
  )
}
