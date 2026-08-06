/**
 * Reporte de la revisión AI de subtítulos en pantalla (Grok visión).
 * Vive en content_idea_videos.scene_check (jsonb). Importable desde
 * componentes cliente — NO importar nada server-only aquí.
 */

export interface SceneCheckIssue {
  /** Texto tal como aparece en pantalla. */
  text: string
  /** Explicación del error, en español: «exelente» → falta la c: «excelente». */
  problem: string
  /** Segundo aproximado del video donde aparece (null si no se pudo mapear). */
  approxSecond: number | null
}

export type SceneCheckStatus = 'ok' | 'issues' | 'error' | 'skipped'

export interface SceneCheckReport {
  status: SceneCheckStatus
  checkedAt: string // ISO
  framesAnalyzed: number
  issues: SceneCheckIssue[]
  /** Descripción corta del contenido del video (tema para el caption automático). */
  videoTopic: string | null
  /** Presente cuando status === 'error' | 'skipped'. */
  error?: string
}
