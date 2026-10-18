import { displayCaptionDraft } from '@/lib/utils/caption-draft'

export type ReciboSearchIdea = {
  title?: string | null
  hook?: string | null
  generated_caption?: string | null
  caption_draft?: string | null
  client?: { name?: string | null } | null
}

/** Client-side Recibo filter: empty query keeps every card. */
export function filterReciboIdeas<T extends ReciboSearchIdea>(ideas: T[], query: string): T[] {
  const needle = query.trim().toLocaleLowerCase('es')
  if (!needle) return ideas
  return ideas.filter((idea) => reciboSearchHaystack(idea).includes(needle))
}

function reciboSearchHaystack(idea: ReciboSearchIdea): string {
  return [
    idea.client?.name,
    idea.title,
    idea.hook,
    idea.generated_caption,
    displayCaptionDraft(idea.caption_draft),
  ]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join('\n')
    .toLocaleLowerCase('es')
}
