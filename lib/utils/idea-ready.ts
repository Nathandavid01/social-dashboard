const filled = (s?: string | null) => !!s && s.trim().length > 0

/** Minimum idea fields required before writing the caption (and recording). */
export function isIdeaReadyForCaption(idea: {
  hook?: string | null
  visual_brief?: string | null
}): boolean {
  return filled(idea.hook) && filled(idea.visual_brief)
}

/** Spanish labels for idea fields still missing before caption. */
export function ideaReadyMissingLabels(idea: {
  hook?: string | null
  visual_brief?: string | null
  caption_angle?: string | null
}): string[] {
  const out: string[] = []
  if (!filled(idea.hook)) out.push('hook')
  if (!filled(idea.visual_brief)) out.push('brief visual')
  if (!filled(idea.caption_angle)) out.push('ángulo del caption')
  return out
}
