import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/sidebar'
import { Topbar } from '@/components/layout/topbar'
import { DashboardProviders } from '@/components/layout/dashboard-providers'
import { ChatBubble } from '@/components/chat/chat-bubble'
import { Toaster } from '@/components/ui/toaster'
import { CommandPalette } from '@/components/shared/command-palette'
import { RequestNotifier } from '@/components/shared/request-notifier'
import { VideoReviewNotifier } from '@/components/shared/video-review-notifier'
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
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    profile = data as Profile | null
    role = profile?.role ?? null
  }

  const authUser = user ? { id: user.id, email: user.email ?? '' } : null

  let alertQuery = supabase.from('alerts').select('id', { count: 'exact', head: true })
  if (user) alertQuery = alertQuery.not('dismissed_by', 'cs', JSON.stringify([user.id]))

  const nowIso = new Date().toISOString()
  const [{ count: alertCount }, { count: overdueCount }, { count: pendingRequestsCount }, { count: videoReviewCount }] = await Promise.all([
    alertQuery,
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
  ])

  return (
    <DashboardProviders user={authUser} profile={profile} role={role}>
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar overdueCount={overdueCount ?? 0} requestsCount={pendingRequestsCount ?? 0} videoReviewCount={videoReviewCount ?? 0} />
        <div className="flex flex-col flex-1 min-w-0 lg:ml-60">
          <Topbar alertCount={alertCount ?? 0} overdueCount={overdueCount ?? 0} requestsCount={pendingRequestsCount ?? 0} videoReviewCount={videoReviewCount ?? 0} />
          <main className="flex-1 overflow-y-auto">
            <div className="p-4 lg:p-6">{children}</div>
          </main>
        </div>
        <Toaster />
        <ChatBubble />
        <CommandPalette />
        <RequestNotifier />
        <VideoReviewNotifier />
      </div>
    </DashboardProviders>
  )
}
