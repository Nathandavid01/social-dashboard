export type WorkflowStepStatus = 'agendar' | 'ideas' | 'reagendar' | 'listo'

export interface WorkflowSettings {
  weekly_planning_enabled: boolean
  scheduling_window_days: number
  min_ideas_per_session: number
  ideas_multiplier: number
  require_rescheduling: boolean
  steps: { slug: string; name: string; required: boolean }[]
}

export interface ClientWorkflowProgress {
  clientId: string
  clientName: string
  postingDays: number[]
  status: WorkflowStepStatus
  hasUpcomingSession: boolean
  nextSessionAt: string | null
  lastSessionAt: string | null
  ideaCount: number
  ideasTarget: number
  needsRescheduling: boolean
}

export const STATUS_META: Record<WorkflowStepStatus, { label: string; tone: string }> = {
  reagendar: { label: 'Reagendar',    tone: 'text-red-500 bg-red-500/10 border-red-500/30' },
  agendar:   { label: 'Sin agendar',  tone: 'text-orange-500 bg-orange-500/10 border-orange-500/30' },
  ideas:     { label: 'Faltan ideas', tone: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30' },
  listo:     { label: 'Listo',        tone: 'text-green-500 bg-green-500/10 border-green-500/30' },
}
