import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { AuthProvider } from '@/lib/context/auth-context'
import { useHasAnyPermission, useCurrentUserId } from './role-gate'
import type { Profile, UserRole } from '@/lib/supabase/types'

function wrapper(value: { user: { id: string; email: string } | null; role: UserRole | null }) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <AuthProvider value={{ user: value.user, role: value.role, profile: null as Profile | null }}>
        {children}
      </AuthProvider>
    )
  }
}

describe('useHasAnyPermission — coordinator follow-up: "ver lo propio"', () => {
  it('true cuando el rol tiene AL MENOS uno de los permisos pedidos', () => {
    const { result } = renderHook(() => useHasAnyPermission(['revision.read', 'entregas.read', 'planning.read']), {
      wrapper: wrapper({ user: { id: 'u1', email: 'a@x.com' }, role: 'copy' }),
    })
    expect(result.current).toBe(true) // copy tiene entregas.read + revision.read
  })

  it('false cuando el rol no tiene NINGUNO de los permisos pedidos', () => {
    const { result } = renderHook(() => useHasAnyPermission(['revision.read', 'entregas.read', 'planning.read']), {
      wrapper: wrapper({ user: { id: 'u1', email: 'a@x.com' }, role: 'video' }),
    })
    expect(result.current).toBe(false) // el rol video no tiene ninguno de los tres
  })
})

describe('useCurrentUserId', () => {
  it('devuelve el id del usuario autenticado', () => {
    const { result } = renderHook(() => useCurrentUserId(), {
      wrapper: wrapper({ user: { id: 'u1', email: 'a@x.com' }, role: 'video' }),
    })
    expect(result.current).toBe('u1')
  })

  it('devuelve null sin sesión', () => {
    const { result } = renderHook(() => useCurrentUserId(), {
      wrapper: wrapper({ user: null, role: null }),
    })
    expect(result.current).toBeNull()
  })
})
