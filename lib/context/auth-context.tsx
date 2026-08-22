'use client'

import { createContext, useContext } from 'react'
import type { Profile, UserRole } from '@/lib/supabase/types'

export interface ViewAsEditorOption {
  id: string
  full_name: string | null
}

interface AuthContextValue {
  user: { id: string; email: string } | null
  profile: Profile | null
  /** Rol para menú y permisos de pantalla (puede ser el del editor si hay vista). */
  role: UserRole | null
  realRole: UserRole | null
  viewAsEditor: ViewAsEditorOption | null
  editors: ViewAsEditorOption[]
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  profile: null,
  role: null,
  realRole: null,
  viewAsEditor: null,
  editors: [],
})

const EMPTY: AuthContextValue = {
  user: null,
  profile: null,
  role: null,
  realRole: null,
  viewAsEditor: null,
  editors: [],
}

export function AuthProvider({
  children,
  value,
}: {
  children: React.ReactNode
  value: Partial<AuthContextValue> & Pick<AuthContextValue, 'user' | 'profile' | 'role'>
}) {
  return <AuthContext.Provider value={{ ...EMPTY, ...value }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
