'use server'

/**
 * Unified video preview — routes by storage_provider so pipeline R2 (`r2`) and
 * Entregas R2 (`entregas-r2`) are both viewable. Call this from UI instead of
 * hard-coding getR2PreviewUrl (which rejects entregas rows).
 */

import { getR2PreviewUrl } from '@/lib/actions/idea-videos-r2'
import { getEntregasPreviewUrl } from '@/lib/actions/entregas-r2'
import { createClient } from '@/lib/supabase/server'

export async function getVideoPreviewUrl(
  videoId: string,
): Promise<{ url?: string; provider?: string; error?: string }> {
  if (!videoId) return { error: 'Video no encontrado' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('content_idea_videos')
    .select('id, storage_provider, status')
    .eq('id', videoId)
    .maybeSingle()

  if (error || !data) return { error: 'Video no encontrado' }
  if (data.status === 'archived' || data.status === 'failed') {
    return { error: 'Este video no está disponible para preview' }
  }

  const provider = data.storage_provider as string

  if (provider === 'r2') {
    const res = await getR2PreviewUrl(videoId)
    return res.error ? { error: res.error, provider } : { url: res.url, provider }
  }

  if (provider === 'entregas-r2') {
    const res = await getEntregasPreviewUrl(videoId)
    return res.error ? { error: res.error, provider } : { url: res.url, provider }
  }

  if (provider === 'drive') {
    return { error: 'Preview de Google Drive no está soportado aquí. Abre el enlace en Drive.', provider }
  }

  return { error: `Proveedor de storage no soportado: ${provider}`, provider }
}
