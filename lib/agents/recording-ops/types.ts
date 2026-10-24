/**
 * Shared types for the recording-ops agent squad.
 *
 * Fields map to existing dashboard columns (`recording_sessions`,
 * `content_ideas`, `clients`, `profiles`). Do not invent parallel schema.
 */

export const RECORDING_OPS_TIMEZONE = 'America/Puerto_Rico' as const

/** Calendar UI says "Sin Videógrafo". Same gap (`videographer_id` null) is SIN VIDEO here. */
export const SIN_VIDEO_LABEL = 'SIN VIDEO' as const

export type RecordingSessionStatus = 'scheduled' | 'completed' | 'cancelled'
export type RecordingConfirmationStatus = 'unconfirmed' | 'confirmed'

/** Ops-facing slice of `recording_sessions` (+ joined client / videographer names). */
export interface RecordingSession {
  id: string
  session_date: string
  start_time: string | null
  end_time: string | null
  title: string
  status: RecordingSessionStatus
  client_id: string | null
  client_name: string | null
  videographer_id: string | null
  videographer_name: string | null
  confirmation_status: RecordingConfirmationStatus
  client_confirmed_at: string | null
  videographer_confirmed_at: string | null
}

/** Ops-facing slice of `content_ideas` used for per-session quotas. */
export interface SessionIdea {
  id: string
  title: string | null
  status: string
  client_id: string | null
  recording_session_id: string | null
}

export interface OpsClient {
  id: string
  name: string
  posting_days: number[] | null
  assigned_to: string | null
  assignee_name: string | null
}

export interface OpsVideographer {
  id: string
  full_name: string
  daily_video_capacity?: number | null
}

export interface RecordingOpsSnapshot {
  sessions: RecordingSession[]
  ideas: SessionIdea[]
  clients: OpsClient[]
  videographers: OpsVideographer[]
}

export interface DateWindow {
  from: string
  to: string
}

export interface UnconfirmedClient {
  sessionId: string
  clientId: string | null
  clientName: string
  sessionDate: string
  startTime: string | null
  confirmationStatus: RecordingConfirmationStatus
  missingSides: Array<'client' | 'videographer'>
}

export interface IdeaAssignment {
  sessionId: string
  clientId: string | null
  clientName: string
  sessionDate: string
  requiredCount: number
  linkedCount: number
  pendingCount: number
  assigneeId: string | null
  assigneeName: string | null
}

export interface VideographerGap {
  sessionId: string
  sessionDate: string
  clientName: string
  currentVideographerId: string | null
  label: typeof SIN_VIDEO_LABEL
  proposedVideographerId: string | null
  proposedVideographerName: string | null
  rationale: string
}

export interface SchedulerAssignment {
  videographerId: string | null
  videographerName: string
  days: string[]
  sessionIds: string[]
  message: string
}

export interface ReminderPayload {
  sessionId: string
  channel: 'email' | 'slack' | 'in_app'
  to: string
  subject: string
  body: string
  /** Scaffold never sends reminders. */
  send: false
}

export interface WriteProposal {
  kind: 'assign_videographer'
  sessionId: string
  videographerId: string
  applied: false
  reason: string
}

export interface DailyDigest {
  generatedAt: string
  timezone: typeof RECORDING_OPS_TIMEZONE
  window: DateWindow
  dryRun: boolean
  sessionCount: number
  scheduler: SchedulerAssignment[]
  unconfirmed: UnconfirmedClient[]
  reminders: ReminderPayload[]
  ideas: IdeaAssignment[]
  videographerGaps: VideographerGap[]
  writeActions: WriteProposal[]
}

export interface WriteGate {
  dryRun?: boolean
  /** Required before any write stub may even claim to proceed. */
  ericApproved?: boolean
}

export interface CycleInput {
  snapshot: RecordingOpsSnapshot
  window: DateWindow
  now?: Date
  dryRun?: boolean
}
