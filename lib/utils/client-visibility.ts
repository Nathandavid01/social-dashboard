import type { UserRole } from '@/lib/supabase/types'

/**
 * Which clients a user may submit videos for.
 *
 * IMPORTANT — this is a CONVENIENCE filter, not access control. The `clients`
 * read policy is plain `authenticated read` (migration 0001), so any logged-in
 * user can still read every client row. This keeps an editor from scrolling 50
 * accounts to find their 3; it does not stop anyone determined. Enforcing it
 * needs an RLS read policy on public.clients keyed on assigned_to.
 *
 * One assignee per client — `clients.assigned_to` is a single uuid. Sharing a
 * client between editors would need a join table.
 */

export interface AssignableClient {
  id: string
  name: string
  assigned_to: string | null
}

/** Roles that work the whole roster rather than their own assignments. */
const SEES_ALL: UserRole[] = ['owner', 'supervisor']

export function clientsForUser<T extends AssignableClient>(
  role: UserRole | null | undefined,
  userId: string | null | undefined,
  clients: T[],
): T[] {
  // Fail closed: an unknown role or missing session sees nothing, never everything.
  if (!role) return []
  if (SEES_ALL.includes(role)) return clients
  if (!userId) return []
  return clients.filter((c) => c.assigned_to === userId)
}
