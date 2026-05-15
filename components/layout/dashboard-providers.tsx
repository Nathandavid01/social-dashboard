'use client'

import { AuthProvider } from '@/lib/context/auth-context'
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
      {children}
    </AuthProvider>
  )
}
