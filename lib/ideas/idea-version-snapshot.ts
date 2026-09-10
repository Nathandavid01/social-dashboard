/**
 * Snapshot shape stored in content_idea_versions.snapshot before an overwrite.
 * Pure helpers so unit tests don't need Supabase.
 */

export const IDEA_VERSION_SELECT =
  'id, title, hook, visual_brief, caption_angle, hashtags_suggestion, status, content_type, shot_type, reference_url, rationale, shooting_notes' as const

export interface IdeaVersionSnapshot {
  title: string | null
  hook: string | null
  visual_brief: string | null
  caption_angle: string | null
  hashtags_suggestion: string | null
  status: string | null
  content_type?: string | null
  shot_type?: string | null
  reference_url?: string | null
  rationale?: string | null
  shooting_notes?: string | null
}

export type IdeaVersionReason =
  | 'brief_updated'
  | 'title_updated'
  | 'discarded'
  | 'status_changed'
  | 'fields_updated'

/** Build the jsonb snapshot from a content_ideas row (previous values). */
export function buildIdeaVersionSnapshot(
  row: Record<string, unknown> | null | undefined,
): IdeaVersionSnapshot | null {
  if (!row || typeof row !== 'object') return null
  return {
    title: (row.title as string | null | undefined) ?? null,
    hook: (row.hook as string | null | undefined) ?? null,
    visual_brief: (row.visual_brief as string | null | undefined) ?? null,
    caption_angle: (row.caption_angle as string | null | undefined) ?? null,
    hashtags_suggestion: (row.hashtags_suggestion as string | null | undefined) ?? null,
    status: (row.status as string | null | undefined) ?? null,
    content_type: (row.content_type as string | null | undefined) ?? null,
    shot_type: (row.shot_type as string | null | undefined) ?? null,
    reference_url: (row.reference_url as string | null | undefined) ?? null,
    rationale: (row.rationale as string | null | undefined) ?? null,
    shooting_notes: (row.shooting_notes as string | null | undefined) ?? null,
  }
}
