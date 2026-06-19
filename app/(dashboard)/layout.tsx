import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/sidebar'
import { SidebarAwareContent } from '@/components/layout/sidebar-aware-content'
import { Topbar } from '@/components/layout/topbar'
import { DashboardProviders } from '@/components/layout/dashboard-providers'
import { ChatBubble } from '@/components/chat/chat-bubble'
import { Toaster } from '@/components/ui/toaster'
import { CommandPalette } from '@/components/shared/command-palette'
import { RequestNotifier } from '@/components/shared/request-notifier'
import { AvatarSetupGate } from '@/components/account/avatar-setup-gate'
import { VideoReviewNotifier } from '@/components/shared/video-review-notifier'
import { NateTopProgress } from '@/components/shared/nate-top-progress'
import { getMyNotifications, getMyUnreadCount } from '@/lib/actions/notifications'
import { getWorkflowProgress } from '@/lib/utils/workflow-progress'
import { getCurrentRole } from '@/lib/auth/server'
import { resolveApprovalRedirect } from '@/lib/utils/approval-core'
import type { Profile, UserRole } from '@/lib/supabase/types'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let profile: Profile | null = null
  let role: UserRole | null = null

  if (user) {
    // Backfills profile if the signup trigger never ran.
    const ensuredRole = await getCurrentRole()

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()
    profile = data as Profile | null
    role = profile?.role ?? ensuredRole

    // Deactivated accounts are locked out of the entire dashboard.
    if (profile && profile.status === 'inactive') {
      await supabase.auth.signOut()
      redirect('/login?deactivated=1')
    }

    // Accounts awaiting approval (or rejected) can't enter the dashboard. Pending
    // users see the waiting screen; rejected users get signed out at /login.
    const approvalRedirect = resolveApprovalRedirect(profile)
    if (approvalRedirect) {
      if (profile?.approval_status === 'rejected') {
        await supabase.auth.signOut()
      }
      redirect(approvalRedirect)
    }
  }

  const authUser = user ? { id: user.id, email: user.email ?? '' } : null

  const nowIso = new Date().toISOString()
  const [
    { count: overdueCount },
    { count: pendingRequestsCount },
    { count: videoReviewCount },
    notifications,
    unreadCount,
  ] = await Promise.all([
    supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .neq('status', 'completed')
      .not('due_at', 'is', null)
      .lt('due_at', nowIso),
    supabase
      .from('client_requests')
      .select('id', { count: 'exact', head: true })
      .in('status', ['new', 'in_review']),
    supabase
      .from('video_reviews')
      .select('id', { count: 'exact', head: true })
      .in('status', ['submitted', 'revision_needed']),
    getMyNotifications(30),
    getMyUnreadCount(),
  ])

  const { pendingCount: planningPendingCount } = await getWorkflowProgress().catch(() => ({ pendingCount: 0 }))

  const currentUserForTopbar = profile
    ? { id: profile.id, full_name: profile.full_name, avatar_url: profile.avatar_url }
    : null

  return (
    <DashboardProviders user={authUser} profile={profile} role={role}>
      <NateTopProgress />
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar
          overdueCount={overdueCount ?? 0}
          requestsCount={pendingRequestsCount ?? 0}
          videoReviewCount={videoReviewCount ?? 0}
          planningPendingCount={planningPendingCount}
          navPreferences={profile?.nav_preferences}
          areaAccess={profile?.area_access ?? null}
        />
        <SidebarAwareContent>
          <Topbar
            overdueCount={overdueCount ?? 0}
            requestsCount={pendingRequestsCount ?? 0}
            videoReviewCount={videoReviewCount ?? 0}
            notifications={notifications}
            unreadCount={unreadCount}
            currentUser={currentUserForTopbar}
          />
          <main className="flex-1 overflow-y-auto">
            <div className="p-4 lg:p-6">{children}</div>
          </main>
        </SidebarAwareContent>
        <Toaster />
        <ChatBubble />
        <CommandPalette />
        <RequestNotifier />
        <VideoReviewNotifier />
        <AvatarSetupGate />
      </div>
    </DashboardProviders>
  )
}
