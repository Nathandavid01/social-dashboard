'use server'

import { currentUserHas } from '@/lib/auth/server'
import { signCoverUrls } from '@/lib/integrations/r2-cover-urls'

/**
 * Carátulas del Banco de Video (/banco): UNA imagen por crudo (el primer
 * thumb_key), presignada en lote. El banco es solo-carátula a propósito —
 * nunca carga video — y este batch evita una acción por tile.
 */

export async function getBankCoverUrls(
  videoIds: string[],
): Promise<{ urls?: Record<string, string>; error?: string }> {
  if (!(await currentUserHas('video_bank.read'))) return { error: 'No autorizado' }
  return signCoverUrls(videoIds)
}
