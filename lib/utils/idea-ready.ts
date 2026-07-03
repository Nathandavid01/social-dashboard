const filled = (s?: string | null) => !!s && s.trim().length > 0

/**
 * Minimum before the AI can write the caption: just say WHAT the video is
 * about (the hook/topic) — same bar as the idea generator's quick captions.
 * Visual brief, angle, etc. are optional detail that enriches the prompt but
 * never blocks the team.
 */
export function isIdeaReadyForCaption(idea: {
  hook?: string | null
  visual_brief?: string | null
}): boolean {
  return filled(idea.hook)
}

/** Spanish labels for idea fields still missing before caption. */
export function ideaReadyMissingLabels(idea: {
  hook?: string | null
  visual_brief?: string | null
  caption_angle?: string | null
}): string[] {
  return filled(idea.hook) ? [] : ['de qué es el video']
}
