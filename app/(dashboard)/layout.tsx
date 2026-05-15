import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/sidebar'
import { Topbar } from '@/components/layout/topbar'
import { DashboardProviders } from '@/components/layout/dashboard-providers'
import { Toaster } from '@/components/ui/toaster'
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

  return (
    <DashboardProviders user={authUser} profile={profile} role={role}>
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar />
        <div className="flex flex-col flex-1 min-w-0 lg:ml-60">
          <Topbar />
          <main className="flex-1 overflow-y-auto">
            <div className="p-4 lg:p-6">{children}</div>
          </main>
        </div>
        <Toaster />
      </div>
    </DashboardProviders>
  )
}
