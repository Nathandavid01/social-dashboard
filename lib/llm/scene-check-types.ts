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

export type ClientMatchStatus = 'match' | 'mismatch' | 'uncertain'

export interface ClientMatchResult {
  /** match solo con evidencia positiva; mismatch solo con evidencia de otro negocio. */
  status: ClientMatchStatus
  /** Explicación corta y humana del veredicto. */
  reason: string
  /** Señales concretas vistas en los frames (logo, nombre, producto, local). */
  evidence: string[]
}

export interface SceneCheckReport {
  status: SceneCheckStatus
  checkedAt: string // ISO
  framesAnalyzed: number
  issues: SceneCheckIssue[]
  /** Descripción corta del contenido del video (tema para el caption automático). */
  videoTopic: string | null
  /** Compatibilidad: reportes creados antes de esta verificación no lo tienen. */
  clientMatch?: ClientMatchResult
  /** Presente cuando status === 'error' | 'skipped'. */
  error?: string
}
