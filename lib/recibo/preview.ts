import type { IdeaWithPipeline } from '@/lib/supabase/types'

/**
 * Latest usable edited Entregas file id on an idea (client-side mirror of
 * getEntregaVideoEditado). Null → show "Sin video editado".
 */
export function editedEntregasVideoId(
  idea: Pick<IdeaWithPipeline, 'videos'>,
): string | null {
  const candidates = (idea.videos ?? []).filter(
    (v) =>
      v.kind === 'edited' &&
      v.storage_provider === 'entregas-r2' &&
      v.status !== 'failed' &&
      v.status !== 'archived' &&
      !!v.drive_file_id &&
      !!v.id,
  )
  if (candidates.length === 0) return null
  const sorted = [...candidates].sort((a, b) =>
    (b.uploaded_at ?? '').localeCompare(a.uploaded_at ?? ''),
  )
  return sorted[0]?.id ?? null
}
