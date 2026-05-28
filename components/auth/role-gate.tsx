'use client'

import { type ReactNode } from 'react'
import { useAuth } from '@/lib/context/auth-context'
import { hasAnyPermission, hasPermission, type Permission } from '@/lib/auth/permissions'

interface Props {
  /** Show children when the user has this permission… */
  perm?: Permission
  /** …or any of these. */
  any?: Permission[]
  /** Render this when permission is denied. */
  fallback?: ReactNode
  children: ReactNode
}

/**
 * Wrap any UI region that should be gated by role. Skip rendering server data
 * fetches with this — gate the server action / route instead. This is for
 * the visual layer only.
 *
 * Usage:
 *   <RoleGate perm="clients.billing.edit"><BillingForm /></RoleGate>
 *   <RoleGate any={['team.read','team.assign_roles']} fallback={null}>…</RoleGate>
 */
export function RoleGate({ perm, any, fallback = null, children }: Props) {
  const { role } = useAuth()
  const allowed = perm
    ? hasPermission(role, perm)
    : any
      ? hasAnyPermission(role, any)
      : true
  return <>{allowed ? children : fallback}</>
}

export function useHasPermission(perm: Permission): boolean {
  const { role } = useAuth()
  return hasPermission(role, perm)
}
