import { BATCH_STAGES, STAGE_LABEL_ES, type BatchStageKey } from '@/lib/utils/content-batches'

/** profile id per pipeline column — configured in /settings/workflow. */
export type PipelineStepAssignees = Partial<Record<BatchStageKey, string>>

export interface StepAssignee {
  id: string
  name: string
}

const STAGE_KEYS = new Set<string>(BATCH_STAGES.map((s) => s.key))

/** Parse the jsonb column from workflow_settings (ignores unknown keys). */
export function parsePipelineStepAssignees(raw: unknown): PipelineStepAssignees {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: PipelineStepAssignees = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (STAGE_KEYS.has(k) && typeof v === 'string' && v.trim()) out[k as BatchStageKey] = v
  }
  return out
}

export function resolveStepAssignee(
  stage: BatchStageKey,
  assignees: PipelineStepAssignees,
  profilesById: Record<string, string>,
): StepAssignee | null {
  const id = assignees[stage]
  if (!id) return null
  const name = profilesById[id]
  if (!name) return null
  return { id, name }
}

export function stageLabelEs(stage: BatchStageKey): string {
  return STAGE_LABEL_ES[stage]
}
