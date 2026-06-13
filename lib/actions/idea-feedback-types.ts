import type { ContentIdeaType } from '@/lib/supabase/types'

/** Payload to approve (✓) or reject (✗) a generated idea from the Idea Lab. */
export interface RateIdeaInput {
  verdict: 'approved' | 'rejected'
  clientId?: string | null
  contentType: ContentIdeaType
  objective?: string | null
  funnelStage?: string | null
  title: string
  hook?: string | null
  visualBrief?: string | null
  captionAngle?: string | null
  hashtagsSuggestion?: string | null
  rationale?: string | null
  theme?: string | null
  trends?: string[]
}

/** An approved idea as shown to editors/designers in "Ideas Aprobadas". */
export interface ApprovedIdea {
  id: string
  client_id: string | null
  content_type: ContentIdeaType
  objective: string | null
  funnel_stage: string | null
  title: string
  hook: string | null
  visual_brief: string | null
  caption_angle: string | null
  hashtags_suggestion: string | null
  rationale: string | null
  theme: string | null
  created_at: string
  /** Caption + Metricool draft state (idea_lab_feedback, migration 0035). */
  generated_caption: string | null
  caption_platform: string | null
  metricool_post_id: number | null
  metricool_scheduled_for: string | null
  client?: { id: string; name: string; metricool_blog_id: string | null } | null
}

/** Recent approvals/rejections fed back into generation (the learning loop). */
export interface IdeaFeedbackExamples {
  approved: string[]
  rejected: string[]
}
