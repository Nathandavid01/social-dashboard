'use client'

import { createContext, useContext } from 'react'
import type { Profile, UserRole } from '@/lib/supabase/types'

interface AuthContextValue {
  user: { id: string; email: string } | null
  profile: Profile | null
  role: UserRole | null
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  profile: null,
  role: null,
})

export function AuthProvider({
  children,
  value,
}: {
  children: React.ReactNode
  value: AuthContextValue
}) {
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
