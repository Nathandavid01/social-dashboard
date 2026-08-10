import type { ContentIdeaVideo, IdeaWithPipeline } from '@/lib/supabase/types'

export type BatchVideoThumbRef = {
  id: string
  name: string
  storageProvider: ContentIdeaVideo['storage_provider']
  /** R2/Drive object key — useful when building public URLs client-side is possible. */
  key: string | null
}

/**
 * Videos the editor uploaded for a client batch, newest first.
 * Used by the pipeline board strip (max 3 slots).
 *
 * Only `edited` + non-archived rows: raw/broll are capture, not editor delivery.
 */
export function pickBatchEditedVideos(
  ideas: IdeaWithPipeline[],
  limit = 3,
): BatchVideoThumbRef[] {
  const seen = new Set<string>()
  const collected: (BatchVideoThumbRef & { uploadedAt: string })[] = []

  for (const idea of ideas) {
    for (const v of idea.videos ?? []) {
      if (v.kind !== 'edited') continue
      if (v.status === 'archived' || v.status === 'failed') continue
      if (seen.has(v.id)) continue
      seen.add(v.id)
      collected.push({
        id: v.id,
        name: v.name || 'Video',
        storageProvider: v.storage_provider,
        key: v.drive_file_id,
        uploadedAt: v.uploaded_at ?? '',
      })
    }
  }

  collected.sort((a, b) => (a.uploadedAt < b.uploadedAt ? 1 : a.uploadedAt > b.uploadedAt ? -1 : 0))
  return collected.slice(0, Math.max(0, limit)).map(({ uploadedAt: _u, ...rest }) => rest)
}
