'use server'

import { revalidatePath } from 'next/cache'
import { requirePermission } from '@/lib/auth/server'
import {
  runPoolPublicadoSync,
  type PoolPublicadoSyncResult,
} from '@/lib/metricool/pool-publicado-sync'

/**
 * Confirma Publicado desde Metricool para el Panel (videos Agendados).
 * No crea posts. No sustituye Recibo “Ya se posteó” para envíos sin Metricool.
 */
export async function syncPoolPublicado(): Promise<PoolPublicadoSyncResult> {
  await requirePermission('posting.read')
  const res = await runPoolPublicadoSync()
  if (res.updated > 0) {
    revalidatePath('/pool')
    revalidatePath('/calendar')
    revalidatePath('/recibo')
  }
  return res
}
