export type UserRole = 'owner' | 'supervisor' | 'editor' | 'video' | 'team_member'
export type UserStatus = 'active' | 'inactive'
export type ClientStatus = 'active' | 'paused' | 'onboarding'
export type SocialPlatform = 'instagram' | 'facebook' | 'tiktok' | 'linkedin'
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'blocked'
export type TaskType = 'content_creation' | 'scheduling' | 'reporting' | 'client_call' | 'review' | 'other'
export type AlertSeverity = 'info' | 'warning' | 'error' | 'success'
export type ContentStatus = 'draft' | 'scheduled' | 'published' | 'cancelled'

export interface NavPreferences {
  order?: string[]
  hidden?: string[]
}

export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  role: UserRole
  status: UserStatus
  title: string | null
  nav_preferences?: NavPreferences
  created_at: string
  updated_at: string
}

export interface BrandColors {
  primary?: string | null
  secondary?: string | null
  accent?: string | null
  text?: string | null
}

export type ClientAssetKind = 'logo' | 'color_guide' | 'font' | 'legal' | 'contract' | 'other'

export interface ClientAsset {
  id: string
  client_id: string
  kind: ClientAssetKind
  name: string
  url: string
  storage_path: string | null
  size_bytes: number | null
  mime_type: string | null
  uploaded_by: string | null
  uploaded_at: string
}

export interface ClientPayment {
  id: string
  client_id: string
  amount: number
  paid_at: string
  method: string | null
  reference: string | null
  notes: string | null
  created_by: string | null
  created_at: string
}

export type PaymentStatus = 'paid' | 'overdue' | 'pending' | 'no_contract'

export type ContentIdeaVideoKind = 'raw' | 'broll' | 'edited'
export type ContentIdeaVideoStatus = 'uploading' | 'uploaded' | 'processing' | 'failed' | 'archived'

export interface ContentIdeaVideo {
  id: string
  idea_id: string
  kind: ContentIdeaVideoKind
  name: string
  drive_file_id: string | null
  drive_view_link: string | null
  drive_thumb_url: string | null
  storage_provider: 'drive' | 'r2' | 'supabase'
  mime_type: string | null
  size_bytes: number | null
  duration_sec: number | null
  notes: string | null
  uploaded_by: string | null
  status: ContentIdeaVideoStatus
  error_message: string | null
  uploaded_at: string
  updated_at: string
}

export type NotificationKind =
  | 'task_assigned' | 'task_due_soon' | 'task_overdue' | 'task_completed'
  | 'request_new' | 'review_pending' | 'review_approved' | 'review_rejected'
  | 'mention' | 'client_message' | 'payment_received' | 'meeting_reminder'
  | 'goal_reached' | 'system'

export type NotificationSeverity = 'info' | 'success' | 'warning' | 'error'

export interface Notification {
  id: string
  user_id: string
  kind: NotificationKind
  title: string
  body: string | null
  link: string | null
  severity: NotificationSeverity
  meta: Record<string, unknown>
  read_at: string | null
  created_at: string
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
  owner_name: string | null
  owner_email: string | null
  owner_phone: string | null
  brand_colors: BrandColors
  logo_url: string | null
  logo_dark_url: string | null
  posting_days: number[]
  posting_time: string | null
  posting_schedule: Record<string, string>
  video_threshold: number
  weekly_post_quota: number | null
  contract_url: string | null
  contract_signed_at: string | null
  contract_expires_at: string | null
  monthly_fee: number | null
  last_meeting_at: string | null
  last_meeting_notes: string | null
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
  location_lat: number | null
  location_lng: number | null
  location_address: string | null
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

/** A unified, read-only event shown on the content calendar (aggregated from
 * multiple sources: manual posting events, idea recording/publish dates, and
 * recording sessions). */
export type CalendarItemType = 'grabacion' | 'publicacion' | 'posting' | 'sesion'

export interface CalendarItem {
  id: string
  type: CalendarItemType
  /** ISO datetime used for day placement. */
  date: string
  title: string
  clientId: string | null
  clientName: string | null
  assignee: Pick<Profile, 'id' | 'full_name'> | null
  /** Optional deep-link (e.g. to the idea detail). */
  href: string | null
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
export type IdeaApprovalStatus = 'pending' | 'submitted' | 'approved' | 'revision_needed'

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
  generated_caption: string | null
  caption_platform: string | null
  caption_generated_at: string | null
  published_at: string | null
  approval_status: IdeaApprovalStatus
  approved_by: string | null
  approved_at: string | null
  submitted_at: string | null
  recording_date: string | null
  publish_date: string | null
  /** User-settable due date (fecha límite) for the video's work. null = none. */
  deadline: string | null
  metricool_post_id: number | null
  metricool_uuid: string | null
  posted_at: string | null
  posting_error: string | null
  posting_started_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  // Joined
  client?: Pick<Client, 'id' | 'name' | 'industry'> | null
  production_task?: Pick<ProductionTask, 'id' | 'status' | 'publish_date'> | null
}

/** A content idea enriched for the Ideación pipeline rows view. */
export interface IdeaWithPipeline extends ContentIdea {
  recordingScheduled: boolean
  videos: ContentIdeaVideo[]
  client?: (Pick<Client, 'id' | 'name' | 'industry'> & Partial<Pick<Client, 'logo_url' | 'platforms' | 'status'>>) | null
  /** Person the linked production task is assigned to (null when unassigned).
   * avatar_url is optional so optimistic updates (from a name-only profile list)
   * still type-check; the fetched data includes it. */
  assignee?: (Pick<Profile, 'id' | 'full_name'> & { avatar_url?: string | null }) | null
}

export type ContentIdeaActivityAction =
  | 'recorded'
  | 'caption_generated'
  | 'caption_saved'
  | 'video_uploaded'
  | 'published'
  | 'posted_to_metricool'
  | 'assigned'
  | 'status_changed'

export interface ContentIdeaActivity {
  id: string
  content_idea_id: string
  client_id: string | null
  user_id: string | null
  action: ContentIdeaActivityAction
  metadata: Record<string, unknown>
  created_at: string
  // Joined
  user?: Pick<Profile, 'id' | 'full_name'> | null
  idea?: Pick<ContentIdea, 'id' | 'title' | 'content_type'> | null
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
