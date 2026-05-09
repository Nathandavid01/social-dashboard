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
  status: TaskStatus
  due_at: string | null
  priority: number
  created_by: string
  created_at: string
  updated_at: string
  // Joined
  client?: Pick<Client, 'id' | 'name'> | null
  assignee?: Pick<Profile, 'id' | 'full_name' | 'avatar_url'> | null
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

export interface Database {
  public: {
    Tables: {
      profiles: { Row: Profile }
      clients: { Row: Client }
      tasks: { Row: Task }
      alerts: { Row: Alert }
      content_events: { Row: ContentEvent }
      performance_metrics: { Row: PerformanceMetric }
    }
  }
}
