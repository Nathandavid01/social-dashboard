'use server'
import { requirePermission } from '@/lib/auth/server'
import { createClient } from '@/lib/supabase/server'

/** Latest playable cut from either dashboard storage; never relabel stored objects. */
export async function getReciboEditedVideo(ideaId: string): Promise<{
  id?: string | null; storage_provider?: string; error?: string
}> {
  try { await requirePermission('entregas.read') }
  catch (error) { return { error: error instanceof Error ? error.message : 'No autorizado' } }
  const supabase = await createClient()
  const { data, error } = await supabase.from('content_idea_videos')
    .select('id, storage_provider').eq('idea_id', ideaId).eq('kind', 'edited')
    .in('storage_provider', ['r2', 'entregas-r2'])
    .not('status', 'in', '(archived,failed)').not('drive_file_id', 'is', null)
    .neq('drive_file_id', '').order('uploaded_at', { ascending: false }).limit(1).maybeSingle()
  if (error) return { error: error.message }
  return data ?? { id: null }
}
