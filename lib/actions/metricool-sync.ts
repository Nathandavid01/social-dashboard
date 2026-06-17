'use server'

import { revalidatePath } from 'next/cache'
import { runMetricoolPublishedSync, type MetricoolSyncResult } from '@/lib/metricool/sync'

/**
 * Server action: sync Metricool publish status into the board, then revalidate
 * the views that show it. Called best-effort when the pipeline is viewed (and by
 * the cron route) so a video that just went live shows up in Publication.
 */
export async function syncMetricoolPublished(): Promise<MetricoolSyncResult> {
  const res = await runMetricoolPublishedSync()
  if (res.updated > 0) {
    revalidatePath('/pipeline')
    revalidatePath('/posting')
    revalidatePath('/published')
  }
  return res
}
