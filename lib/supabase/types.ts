export type UserRole = 'owner' | 'team_member'
export type ClientStatus = 'active' | 'paused' | 'onboarding'
export type SocialPlatform = 'instagram' | 'facebook' | 'tiktok' | 'linkedin'
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'blocked'
export type TaskType = 'content_creation' | 'scheduling' | 'reporting' | 'client_call' | 'review' | 'other'
export type AlertSeverity = 'info' | 'warning' | 'error' | 'success'
export type ContentStatus = 'draft' | 'scheduled' | 'published' | 'cancelled'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  role: UserRole
  title: string | null
  created_at: string
  updated_at: string
}

export interface Client {
  id: string
  name: string
  industry: string | null
  platforms: SocialPlatform[]
  status: ClientStatus
  assigned_to: string | null
  notes: string | null
  brand_voice: string | null
  caption_language: string | null
  default_cta: string | null
  default_hashtags: string | null
  metricool_blog_id: string | null
  caption_notes: string | null
  default_platforms: string[]
  created_by: string
  created_at: string
  updated_at: string
  // Joined
  assignee?: Profile | null
}

export interface Task {
  id: string
  title: string
  description: string | null
  type: TaskType
  client_id: string | null
  assignee_id: string | null
  collaborators: string[]
  status: TaskStatus
  due_at: string | null
  priority: number
  created_by: string
  created_at: string
  updated_at: string
  // Joined
  client?: Pick<Client, 'id' | 'name'> | null
  assignee?: Pick<Profile, 'id' | 'full_name' | 'avatar_url'> | null
  collaboratorProfiles?: Pick<Profile, 'id' | 'full_name'>[]
}

export type RecordingSessionStatus = 'scheduled' | 'completed' | 'cancelled'

export interface RecordingSession {
  id: string
  session_date: string
  client_id: string | null
  videographer_id: string | null
  title: string
  notes: string | null
  location: string | null
  start_time: string | null
  end_time: string | null
  status: RecordingSessionStatus
  created_by: string
  created_at: string
  updated_at: string
  // Joined
  client?: Pick<Client, 'id' | 'name'> | null
  videographer?: Pick<Profile, 'id' | 'full_name'> | null
}

export interface Alert {
  id: string
  title: string
  message: string | null
  severity: AlertSeverity
  target_role: UserRole | null
  dismissed_by: string[]
  created_by: string | null
  expires_at: string | null
  created_at: string
}

export interface ContentEvent {
  id: string
  title: string
  description: string | null
  client_id: string | null
  platform: SocialPlatform
  status: ContentStatus
  scheduled_at: string
  assignee_id: string | null
  media_url: string | null
  created_by: string
  created_at: string
  updated_at: string
  // Joined
  client?: Pick<Client, 'id' | 'name'> | null
  assignee?: Pick<Profile, 'id' | 'full_name'> | null
}

export interface PerformanceMetric {
  id: string
  client_id: string
  platform: SocialPlatform
  metric_date: string
  followers: number
  impressions: number
  reach: number
  engagements: number
  posts_published: number
  created_at: string
}

export interface ClientRequest {
  id: string
  company_name: string
  contact_name: string
  contact_email: string | null
  contact_phone: string | null
  request_type: string
  description: string
  urgency: 'low' | 'normal' | 'high' | 'urgent'
  status: 'new' | 'in_review' | 'converted' | 'rejected'
  task_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface TaskComment {
  id: string
  task_id: string
  author_id: string
  content: string
  created_at: string
  updated_at: string
  // Joined
  author?: Pick<Profile, 'id' | 'full_name' | 'avatar_url'> | null
}

export type VideoReviewStatus =
  | 'submitted'
  | 'head_editor_review'
  | 'pending_final_check'
  | 'final_check_review'
  | 'revision_needed'
  | 'approved'

export const VIDEO_ERROR_TYPES = [
  { slug: 'music',           label: 'Music' },
  { slug: 'b_rolls',         label: 'B-Rolls' },
  { slug: 'grammar',         label: 'Grammar / Text' },
  { slug: 'color',           label: 'Color Grading' },
  { slug: 'audio_sync',      label: 'Audio Sync' },
  { slug: 'transitions',     label: 'Transitions' },
  { slug: 'missing_content', label: 'Missing Content' },
  { slug: 'wrong_footage',   label: 'Wrong Footage' },
  { slug: 'pacing',          label: 'Pacing' },
  { slug: 'captions',        label: 'Captions' },
  { slug: 'branding',        label: 'Branding' },
  { slug: 'other',           label: 'Other' },
] as const

export type VideoErrorSlug = (typeof VIDEO_ERROR_TYPES)[number]['slug']

export interface VideoReview {
  id: string
  title: string
  drive_link: string
  client_id: string | null
  editor_id: string | null
  reviewer_id: string | null
  head_editor_id: string | null
  final_reviewer_id: string | null
  head_editor_approved_at: string | null
  final_approved_at: string | null
  status: VideoReviewStatus
  errors: string[]
  error_notes: string | null
  general_notes: string | null
  revision_count: number
  created_by: string | null
  created_at: string
  updated_at: string
  // Joined
  client?: Pick<Client, 'id' | 'name'> | null
  editor?: Pick<Profile, 'id' | 'full_name'> | null
  reviewer?: Pick<Profile, 'id' | 'full_name'> | null
  head_editor?: Pick<Profile, 'id' | 'full_name'> | null
  final_reviewer?: Pick<Profile, 'id' | 'full_name'> | null
}

export type ProductionContentType = 'R' | 'P'
export type ProductionTaskStatus = 'pendiente' | 'en_edicion' | 'en_revision' | 'revisiones' | 'aprobado' | 'publicado'
export type ProductionPriority = 'alta' | 'media' | 'baja'

export interface ProductionSchedule {
  id: string
  client_id: string
  day_of_week: number  // 1=Monday ... 7=Sunday
  content_type: ProductionContentType
  assigned_editor_id: string | null
  assigned_designer_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
  // Joined
  client?: Pick<Client, 'id' | 'name' | 'industry'> | null
  assigned_editor?: Pick<Profile, 'id' | 'full_name'> | null
  assigned_designer?: Pick<Profile, 'id' | 'full_name'> | null
}

export interface ProductionTask {
  id: string
  client_id: string
  schedule_id: string | null
  content_type: ProductionContentType
  publish_date: string
  deadline: string | null
  assigned_to_id: string | null
  status: ProductionTaskStatus
  notes: string | null
  review_notes: string | null
  is_special_request: boolean
  priority: ProductionPriority
  week_start: string | null
  idea_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  // Joined
  client?: Pick<Client, 'id' | 'name' | 'industry'> | null
  assigned_to?: Pick<Profile, 'id' | 'full_name'> | null
  idea?: Pick<ContentIdea, 'id' | 'title' | 'visual_brief' | 'caption_angle' | 'hook'> | null
}

export type ContentIdeaType = 'R' | 'P' | 'C' | 'S'
export type ContentIdeaStatus = 'idea' | 'asignada' | 'grabada' | 'producida' | 'publicada' | 'descartada'

export interface ContentIdea {
  id: string
  client_id: string
  content_type: ContentIdeaType
  title: string
  hook: string | null
  visual_brief: string | null
  caption_angle: string | null
  hashtags_suggestion: string | null
  rationale: string | null
  status: ContentIdeaStatus
  production_task_id: string | null
  recording_session_id: string | null
  theme: string | null
  generation_prompt: string | null
  model: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  // Joined
  client?: Pick<Client, 'id' | 'name' | 'industry'> | null
  production_task?: Pick<ProductionTask, 'id' | 'status' | 'publish_date'> | null
}

export interface SavedCaptionRow {
  id: string
  client_id: string | null
  video_review_id: string | null
  generated_by: string | null
  video_title: string | null
  platform: string | null
  caption: string
  examples_used: number
  model: string | null
  created_at: string
}

export type PostingDraftStatus = 'sent' | 'failed'

export interface PostingDraft {
  id: string
  video_review_id: string
  client_id: string | null
  scheduled_for: string
  caption: string
  platforms: string[]
  metricool_post_id: number | null
  metricool_uuid: string | null
  status: PostingDraftStatus
  error_message: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  // Joined
  video_review?: Pick<VideoReview, 'id' | 'title' | 'drive_link'> | null
  client?: Pick<Client, 'id' | 'name'> | null
}

export interface Database {
  public: {
    Tables: {
      profiles: { Row: Profile }
      clients: { Row: Client }
      tasks: { Row: Task }
      alerts: { Row: Alert }
      content_events: { Row: ContentEvent }
      performance_metrics: { Row: PerformanceMetric }
      client_requests: { Row: ClientRequest }
      task_comments: { Row: TaskComment }
      recording_sessions: { Row: RecordingSession }
      production_schedules: { Row: ProductionSchedule }
      production_tasks: { Row: ProductionTask }
      video_reviews: { Row: VideoReview }
      posting_drafts: { Row: PostingDraft }
      content_ideas: { Row: ContentIdea }
      saved_captions: { Row: SavedCaptionRow }
    }
  }
}
