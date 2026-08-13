const filled = (s?: string | null) => !!s && s.trim().length > 0

/** True when the idea already has footage (any non-archived upload). */
export function hasCaptionableVideo(
  videos?: Array<{ status?: string | null } | null> | null,
): boolean {
  return (videos ?? []).some((v) => !!v && v.status !== 'archived')
}

export type CaptionReadyIdea = {
  hook?: string | null
  visual_brief?: string | null
  caption_angle?: string | null
  hasVideo?: boolean
}

/**
 * Caption only after there is a topic AND a video. Writing copy for an idea
 * with no footage produced captions that never shipped.
 */
export function isIdeaReadyForCaption(idea: CaptionReadyIdea): boolean {
  return filled(idea.hook) && idea.hasVideo === true
}

/** Spanish labels for what is still missing before caption. */
export function ideaReadyMissingLabels(idea: CaptionReadyIdea): string[] {
  const missing: string[] = []
  if (!filled(idea.hook)) missing.push('de qué es el video')
  if (idea.hasVideo !== true) missing.push('el video')
  return missing
}

/**
 * Day-2 will call generateIdeaCaption when this is true.
 * Never overwrite a draft the team already has, nor an approved caption.
 */
export function shouldAutoDraftCaption(idea: CaptionReadyIdea & {
  caption_draft?: string | null
  generated_caption?: string | null
}): boolean {
  if (!isIdeaReadyForCaption(idea)) return false
  if (filled(idea.caption_draft) || filled(idea.generated_caption)) return false
  return true
}
