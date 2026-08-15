/**
 * Pure predicate: has this piece of content actually gone live, or is it still
 * pending? Distinct from `batch-view.ts`'s "programado pero no publicado" —
 * this one answers the inverse question ("¿está publicado de verdad?") used to
 * paint the ✓ on the weekly production calendar.
 */
export function isReallyPublished(input: {
  taskStatus?: string | null
  ideaStatus?: string | null
  publishedAt?: string | null
}): boolean {
  return (
    input.taskStatus === 'publicado' ||
    input.ideaStatus === 'publicada' ||
    Boolean(input.publishedAt)
  )
}
