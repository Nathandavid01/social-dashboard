'use server'

import { revalidatePath } from 'next/cache'
import { requirePermission } from '@/lib/auth/server'
import { runMetricoolPublishedSync, type MetricoolSyncResult } from '@/lib/metricool/sync'

export type MetricoolCalendarPullResult = MetricoolSyncResult & { ok: boolean }

/**
 * Manual Metricool → calendar pull. Same job the 6-hour cron runs.
 * Never writes to Metricool; only refreshes dashboard dates/status from live posts.
 */
export async function pullMetricoolCalendar(): Promise<MetricoolCalendarPullResult> {
  try {
    await requirePermission('metricool.read')
  } catch (error) {
    return { ok: false, updated: 0, checked: 0, error: error instanceof Error ? error.message : 'Acceso denegado' }
  }
  const res = await runMetricoolPublishedSync()
  try {
    revalidatePath('/published')
    revalidatePath('/calendar')
    revalidatePath('/recibo')
    revalidatePath('/pipeline')
  } catch { /* The pull result stays truthful even if route invalidation is unavailable. */ }
  return { ok: !res.error, ...res }
}
