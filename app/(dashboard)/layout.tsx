import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/sidebar'
import { SidebarAwareContent } from '@/components/layout/sidebar-aware-content'
import { Topbar } from '@/components/layout/topbar'
import { DashboardProviders } from '@/components/layout/dashboard-providers'
import { ChatBubble } from '@/components/chat/chat-bubble'
import { UploadDock } from '@/components/uploads/upload-dock'
import { Toaster } from '@/components/ui/toaster'
import { CommandPalette } from '@/components/shared/command-palette'
import { RequestNotifier } from '@/components/shared/request-notifier'
import { AvatarSetupGate } from '@/components/account/avatar-setup-gate'
import { VideoReviewNotifier } from '@/components/shared/video-review-notifier'
import { NateTopProgress } from '@/components/shared/nate-top-progress'
import { UpdateNotice } from '@/components/shared/update-notice'
import { getMyNotifications, getMyUnreadCount } from '@/lib/actions/notifications'
import { getCurrentRole, getViewAsEditor } from '@/lib/auth/server'
import { listEditorsForViewAs } from '@/lib/actions/view-as'
import { canStartViewAs } from '@/lib/auth/view-as-core'
import { ViewAsBanner } from '@/components/auth/view-as-banner'
import { resolveDashboardRedirect } from '@/lib/utils/approval-core'
import type { Profile, UserRole } from '@/lib/supabase/types'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Sin sesión no hay dashboard: antes el shell se renderizaba anónimo con un
  // usuario placeholder y el sitio "salía logueado" sin estarlo.
  if (!user) redirect(resolveDashboardRedirect(false, null)!)

  // Backfills profile if the signup trigger never ran.
  const [ensuredRole, viewAsEditor] = await Promise.all([
    getCurrentRole(),
    getViewAsEditor(),
  ])

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()
  const profile = data as Profile | null
  const realRole: UserRole | null = profile?.role ?? ensuredRole
  const effectiveRole: UserRole | null = viewAsEditor ? 'editor' : realRole
  const editors = canStartViewAs(realRole) ? await listEditorsForViewAs() : []

  // Deactivated accounts are locked out of the entire dashboard.
  if (profile && profile.status === 'inactive') {
    await supabase.auth.signOut()
    redirect('/login?deactivated=1')
  }

  // Accounts awaiting approval (or rejected) can't enter the dashboard. Pending
  // users see the waiting screen; rejected users get signed out at /login.
  const approvalRedirect = resolveDashboardRedirect(true, profile)
  if (approvalRedirect) {
    if (profile?.approval_status === 'rejected') {
      await supabase.auth.signOut()
    }
    redirect(approvalRedirect)
  }

  const authUser = { id: user.id, email: user.email ?? '' }

  // Only /video-reviews shows a badge in the nav. The counts for /operations,
  // /inbox and /planning were queried on EVERY page render for badges that could
  // never paint — those routes are nav:false.
  const [{ count: videoReviewCount }, notifications, unreadCount] = await Promise.all([
    supabase
      .from('video_reviews')
      .select('id', { count: 'exact', head: true })
      .in('status', ['submitted', 'revision_needed']),
    getMyNotifications(30),
    getMyUnreadCount(),
  ])

  const currentUserForTopbar = profile
    ? { id: profile.id, full_name: profile.full_name, avatar_url: profile.avatar_url }
    : null

  return (
    <DashboardProviders
      user={authUser}
      profile={profile}
      role={effectiveRole}
      realRole={realRole}
      viewAsEditor={viewAsEditor}
      editors={editors}
    >
      <NateTopProgress />
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar
          videoReviewCount={videoReviewCount ?? 0}
          navPreferences={profile?.nav_preferences}
          areaAccess={viewAsEditor ? null : profile?.area_access ?? null}
        />
        <SidebarAwareContent>
          <Topbar
            videoReviewCount={videoReviewCount ?? 0}
            notifications={notifications}
            unreadCount={unreadCount}
            currentUser={currentUserForTopbar}
          />
          <main className="flex-1 overflow-y-auto">
            <ViewAsBanner />
            <div className="p-4 lg:p-6">{children}</div>
          </main>
        </SidebarAwareContent>
        <Toaster />
        <UpdateNotice />
        <ChatBubble />
        <UploadDock />
        <CommandPalette />
        <RequestNotifier />
        <VideoReviewNotifier />
        <AvatarSetupGate />
      </div>
    </DashboardProviders>
  )
}
