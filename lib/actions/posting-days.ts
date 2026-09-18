'use server'

import { createClient as createAdminClient } from '@supabase/supabase-js'
import { requirePermission } from '@/lib/auth/server'
import { revalidateClientCadence } from '@/lib/actions/client-cadence'
import { syncSchedulesToPostingDays } from '@/lib/actions/sync-posting-cadence'

/**
 * Set a client's posting cadence (days of week) from the planning view.
 * Gated by `planning.act`; uses the service role so planners (editors/
 * supervisors) can set cadence even though direct client edits are owner-only.
 */
export async function setClientPostingDays(
  clientId: string,
  days: number[],
): Promise<{ ok?: true; error?: string }> {
  try {
    await requirePermission('planning.act')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  const clean = Array.from(new Set(days.filter((d) => d >= 0 && d <= 6))).sort()

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { error } = await admin
    .from('clients')
    .update({ posting_days: clean, updated_at: new Date().toISOString() })
    .eq('id', clientId)

  if (error) return { error: error.message }

  await syncSchedulesToPostingDays(admin, clientId, clean)
  await revalidateClientCadence(clientId)
  return { ok: true }
}
