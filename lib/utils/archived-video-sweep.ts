/**
 * Barrido diferido del borrado de videos: deleteR2Video (lib/actions/idea-videos-r2.ts)
 * solo ARCHIVA la fila — nunca destruye el objeto en R2 al momento del clic. El
 * objeto real se limpia aquí, en el cron, pasados ARCHIVED_VIDEO_GRACE_DAYS días
 * desde que se archivó (updated_at, que la propia tabla actualiza sola en cada
 * UPDATE — ver supabase/migrations/0019_content_idea_videos.sql).
 *
 * Solo el bucket del PIPELINE (storage_provider 'r2') entra aquí. Entregas usa
 * su propio bucket ('entregas-r2') y su propio flujo de descarte
 * (discardEntregaVideos) que solo archiva — este barrido no lo toca, a
 * propósito: tocar un storage_provider que no es el suyo sería borrar el
 * archivo equivocado.
 */

export const ARCHIVED_VIDEO_GRACE_DAYS = 7

export interface ArchivedVideoRow {
  id: string
  status: string
  storage_provider: string
  drive_file_id: string | null
  updated_at: string
}

export function archivedVideoCandidates(
  videos: ArchivedVideoRow[],
  now: Date = new Date(),
): { id: string; driveFileId: string }[] {
  const cutoff = now.getTime() - ARCHIVED_VIDEO_GRACE_DAYS * 24 * 60 * 60 * 1000
  return videos
    .filter((v) =>
      v.status === 'archived' &&
      v.storage_provider === 'r2' &&
      !!v.drive_file_id &&
      new Date(v.updated_at).getTime() < cutoff,
    )
    .map((v) => ({ id: v.id, driveFileId: v.drive_file_id as string }))
}
