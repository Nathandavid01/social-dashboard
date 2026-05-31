import type { IdeaPipeline, PipelineStageKey } from './idea-pipeline-stages'

/**
 * The single next action a person should take on a video, derived from its
 * pipeline. Lets someone see "what do I do now" at a glance. `done` is true
 * when the video is fully published (nothing left to do).
 */
export interface NextAction {
  label: string
  stage: PipelineStageKey | null
  done: boolean
}

const ACTION_BY_STAGE: Record<PipelineStageKey, string> = {
  idea: 'Definir la idea (hook + brief)',
  caption: 'Generar el caption',
  scheduled: 'Agendar la grabación',
  recorded: 'Grabar y subir el material',
  edited: 'Editar y subir el video',
  approval: 'Enviar a aprobación',
  published: 'Publicar',
}

export function nextAction(pipeline: IdeaPipeline): NextAction {
  const i = pipeline.currentIndex
  if (i >= pipeline.stages.length) {
    return { label: 'Publicado — sin acciones', stage: null, done: true }
  }
  const stage = pipeline.stages[i].key
  return { label: ACTION_BY_STAGE[stage], stage, done: false }
}
