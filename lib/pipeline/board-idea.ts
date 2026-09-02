import type { ContentIdeaVideo, IdeaWithPipeline } from '@/lib/supabase/types'

/**
 * Lo que los tableros (pipeline, entregas, revisión) necesitan de una idea.
 *
 * Por qué existe: la página mandaba al navegador las 400 ideas con TODAS sus
 * columnas (briefs, rationale, prompts, tokens de revisión…): 1.2 MB de HTML
 * en /pipeline. El servidor sigue leyendo la fila completa para sus cálculos;
 * al cliente solo cruza esta proyección. Si un componente necesita un campo
 * nuevo, se añade aquí y tsc lo exige — nunca se "cuela" por un cast.
 */
export const BOARD_IDEA_FIELDS = [
  'id',
  'client_id',
  'content_type',
  'title',
  'hook',
  'visual_brief',
  'shooting_notes',
  'status',
  'production_task_id',
  'recording_session_id',
  'generated_caption',
  'caption_draft',
  'caption_platform',
  'platform_formats',
  'published_at',
  'approval_status',
  'approved_at',
  'submitted_at',
  'recording_date',
  'publish_date',
  'deadline',
  'metricool_post_id',
  'posted_at',
  'posting_error',
  'posting_started_at',
  'created_by',
  'created_at',
  'updated_at',
  'virality_score',
  // joins / derivados
  'recordingScheduled',
  'client',
  'assignee',
  'bankQueue',
  'recording_session',
  'production_task',
] as const satisfies readonly (keyof IdeaWithPipeline)[]

/** Del video, lo que se pinta: estado, tipo, miniaturas y quién/cuándo lo subió. */
export const BOARD_VIDEO_FIELDS = [
  'id',
  'idea_id',
  'kind',
  'name',
  'status',
  'storage_provider',
  'uploaded_by',
  'uploaded_at',
  'duration_sec',
  'drive_file_id',
  'drive_view_link',
  'drive_thumb_url',
  'thumb_keys',
] as const satisfies readonly (keyof ContentIdeaVideo)[]

export type BoardVideo = Pick<ContentIdeaVideo, (typeof BOARD_VIDEO_FIELDS)[number]>

export type PipelineBoardIdea = Pick<IdeaWithPipeline, (typeof BOARD_IDEA_FIELDS)[number]> & {
  videos: BoardVideo[]
}

/** Fila completa del servidor o una ya proyectada (los helpers retipados devuelven esta última). */
type BoardSource = IdeaWithPipeline | PipelineBoardIdea

function pick<T extends object, K extends keyof T>(obj: T, keys: readonly K[]): Pick<T, K> {
  const out: Partial<Pick<T, K>> = {}
  for (const key of keys) {
    if (key in obj) out[key] = obj[key]
  }
  return out as Pick<T, K>
}

/** El join de cliente viene con columnas extra (assigned_to, posting_days) que el tipo no declara y nadie pinta. */
const BOARD_CLIENT_FIELDS = ['id', 'name', 'industry', 'logo_url', 'platforms', 'status'] as const

export function toBoardIdea(idea: BoardSource): PipelineBoardIdea {
  return {
    ...pick(idea, BOARD_IDEA_FIELDS),
    client: idea.client ? pick(idea.client, BOARD_CLIENT_FIELDS) : idea.client,
    videos: (idea.videos ?? []).map((v) => pick(v, BOARD_VIDEO_FIELDS)),
  }
}

/**
 * Lo que cruza al tablero: sin descartadas (ningún tablero las pinta — todos
 * los helpers de cliente las saltan) y solo los campos de la lista.
 */
export function toBoardIdeas(ideas: BoardSource[]): PipelineBoardIdea[] {
  const out: PipelineBoardIdea[] = []
  for (const idea of ideas) {
    if (idea.status === 'descartada') continue
    out.push(toBoardIdea(idea))
  }
  return out
}
