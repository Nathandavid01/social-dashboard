/**
 * Entregas delivery vs legacy pipeline R2.
 *
 * Editor uploads on /revision write `storage_provider = 'entregas-r2'`.
 * The original pipeline (idea-videos-r2) still uses `'r2'`.
 * Boards that show "what editors delivered" must filter by entregas-r2 so
 * historical pipeline rows without Entregas files do not pollute the board.
 */

export type VideoProviderRef = {
  kind?: string | null
  storage_provider?: string | null
  status?: string | null
}

export const ENTREGAS_STORAGE_PROVIDER = 'entregas-r2' as const
export const PIPELINE_STORAGE_PROVIDER = 'r2' as const

/** True when this idea has at least one editor-delivered file on Entregas R2. */
export function ideaHasEntregasEditedVideo(idea: {
  videos?: VideoProviderRef[] | null
}): boolean {
  return (idea.videos ?? []).some(
    (v) =>
      v.kind === 'edited' &&
      v.storage_provider === ENTREGAS_STORAGE_PROVIDER &&
      v.status !== 'archived' &&
      v.status !== 'failed',
  )
}

/** Keep only ideas that completed the Entregas upload path. */
export function filterEntregasDeliveredIdeas<T extends { videos?: VideoProviderRef[] | null }>(
  ideas: T[],
): T[] {
  return ideas.filter(ideaHasEntregasEditedVideo)
}
