import type { VideoAnalysisFindings } from '@/lib/llm/video-analysis-core'

/**
 * ¿El QC dijo que el video ES del cliente? Solo entonces se encadena lo que
 * asume que lo es: escribir "de qué es el video" en la idea y generar el
 * caption con el brand voice y los hashtags del cliente. Un video ajeno con
 * caption del cliente equivocado es peor que un video sin caption.
 *
 * Sin veredicto (respuestas viejas) se deja pasar: el gate cierra solo con un
 * "warning" explícito.
 */
export function qcSaysItIsTheClients(findings: Pick<VideoAnalysisFindings, 'relevance'> | null | undefined): boolean {
  const verdict = findings?.relevance?.verdict
  return verdict !== 'warning'
}
