import { displayCaptionDraft } from '@/lib/utils/caption-draft'

export type ReciboCaptionPlan =
  | { action: 'skip'; caption: string }
  | { action: 'blocked'; error: string }
  | { action: 'fill'; hookToSet: string | null; blogIdToSet: string | null }

/**
 * Decide whether a Recibo video still needs a caption.
 * An existing saved caption or draft is kept.
 * A blank hook uses the video title so generation knows the topic.
 * The Metricool blog is written only when the client does not have one yet.
 */
export function planReciboCaption(input: {
  title?: string | null
  hook?: string | null
  generatedCaption?: string | null
  captionDraft?: string | null
  hasEdited: boolean
  metricoolBlogId?: string | null
  matchedBlogId?: string | null
}): ReciboCaptionPlan {
  const caption = (input.generatedCaption ?? '').trim() || displayCaptionDraft(input.captionDraft)
  if (caption) return { action: 'skip', caption }
  if (!input.hasEdited) return { action: 'blocked', error: 'Este video no tiene editado.' }

  const title = input.title?.trim() || ''
  const hook = input.hook?.trim() || ''
  if (!hook && !title) return { action: 'blocked', error: 'Falta el título para escribir el caption.' }

  const storedBlog = input.metricoolBlogId?.trim() || ''
  const matchedBlog = input.matchedBlogId?.trim() || ''
  if (!storedBlog && !matchedBlog) {
    return { action: 'blocked', error: 'Este cliente no tiene una marca en Metricool.' }
  }

  return {
    action: 'fill',
    hookToSet: hook ? null : title,
    blogIdToSet: storedBlog ? null : matchedBlog,
  }
}
