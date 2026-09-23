import type { UploadItem } from '@/lib/stores/upload-store'
import { aggregateProgress } from './upload-parts'

/**
 * Cómo va la tanda completa, para el dock. El avance pesa por tamaño: con 30
 * crudos de 4 MB a 562 MB, el promedio de porcentajes decía "casi listo"
 * mientras faltaba lo más pesado. Cancelados y duplicados no son de la tanda;
 * un error cuenta en el total (no se subió) pero no suma avance.
 */
export function uploadBatchSummary(
  items: ReadonlyArray<Pick<UploadItem, 'phase' | 'sizeBytes' | 'pct'>>,
): { pct: number; done: number; total: number; queued: number } {
  let done = 0
  let total = 0
  let queued = 0
  let bytes = 0
  let sent = 0
  for (const it of items) {
    if (it.phase === 'cancelado' || it.phase === 'duplicado') continue
    total++
    if (it.phase === 'listo') done++
    if (it.phase === 'en-cola') queued++
    if (it.phase === 'error') continue
    bytes += it.sizeBytes
    sent += (it.sizeBytes * it.pct) / 100
  }
  return { pct: aggregateProgress({ totalBytes: bytes, completedBytes: sent }), done, total, queued }
}
