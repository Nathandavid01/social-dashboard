import type { VideoAnalysisFindings } from '@/lib/llm/video-analysis-core'
import { relevanceConfidence } from '@/lib/llm/video-analysis-core'
import { formatSummaryText } from './video-format-rules'

export type QcCheckState = 'wait' | 'ok' | 'warn'
export interface QcCheckRow {
  key: 'client' | 'captions' | 'format' | 'uploader' | 'errors' | 'frames'
  state: QcCheckState
  text: string
}

/**
 * Las 5 filas fijas del QC al subir un editado: cliente + %, captions
 * quemados, quién lo subió, si hay errores, fotogramas. Pura — la UI solo pinta.
 */
export function qcChecklist(input: {
  status: 'pending' | 'done' | 'error'
  findings: VideoAnalysisFindings | null
  frameCount: number | null | undefined
  uploadedBy: string | null | undefined
}): QcCheckRow[] {
  const { status, findings, frameCount, uploadedBy } = input
  const data = status === 'done' && findings ? findings : null
  const unavailable = status === 'error'

  const client: QcCheckRow = !data
    ? {
        key: 'client',
        state: 'wait',
        text: unavailable ? '¿Del cliente? no disponible' : '¿Del cliente? …',
      }
    : data.relevance.verdict === 'ok'
      ? {
          key: 'client',
          state: 'ok',
          text: `Del cliente · ${relevanceConfidence(data.relevance)}% de confiabilidad`,
        }
      : {
          key: 'client',
          state: 'warn',
          text: `No parece del cliente · ${relevanceConfidence(data.relevance)}% de confiabilidad`,
        }

  let captions: QcCheckRow
  if (!data) {
    captions = {
      key: 'captions',
      state: 'wait',
      text: unavailable ? 'Captions: no disponible' : 'Captions …',
    }
  } else {
    const hasText = data.burned_captions.text.trim().length > 0
    const n = data.burned_captions.issues.length
    if (!hasText && n === 0) {
      captions = { key: 'captions', state: 'warn', text: 'Captions: No tiene captions' }
    } else if (n === 0) {
      captions = { key: 'captions', state: 'ok', text: 'Captions: Libre de errores' }
    } else {
      captions = { key: 'captions', state: 'warn', text: `Captions: ${n} error${n === 1 ? '' : 'es'}` }
    }
  }

  const name = uploadedBy?.trim()
  const uploader: QcCheckRow = name
    ? { key: 'uploader', state: 'ok', text: `Lo subió ${name}` }
    : {
        key: 'uploader',
        state: 'wait',
        text: data || unavailable ? 'Quién lo subió: sin dato' : 'Quién lo subió …',
      }

  const hasIssues = (data?.burned_captions.issues.length ?? 0) > 0
  const errors: QcCheckRow = !data
    ? { key: 'errors', state: 'wait', text: unavailable ? 'Errores: no disponible' : 'Errores …' }
    : hasIssues
      ? { key: 'errors', state: 'warn', text: 'Hay errores de QC' }
      : { key: 'errors', state: 'ok', text: 'Sin errores de QC' }

  const frames: QcCheckRow =
    typeof frameCount === 'number' && frameCount > 0
      ? {
          key: 'frames',
          state: 'ok',
          text: `${frameCount} fotograma${frameCount === 1 ? '' : 's'} extraído${frameCount === 1 ? '' : 's'}`,
        }
      : {
          key: 'frames',
          state: 'wait',
          text: status === 'pending' ? 'Fotogramas: extrayendo…' : 'Fotogramas: todavía no',
        }

  // Formato (reglas, sin IA): llega con el meta del primer chunk. Los videos
  // analizados antes de v4.15 no lo traen: se dice "sin dato", no se inventa.
  const fmt = data?.format
  const format: QcCheckRow = !data
    ? { key: 'format', state: 'wait', text: unavailable ? 'Formato: no disponible' : 'Formato …' }
    : !fmt
      ? { key: 'format', state: 'wait', text: 'Formato: sin dato' }
      : fmt.issues.length === 0
        ? { key: 'format', state: 'ok', text: `Formato: ${formatSummaryText(fmt)}` }
        : { key: 'format', state: 'warn', text: `Formato: ${fmt.issues.length === 1 ? '1 aviso' : `${fmt.issues.length} avisos`} · ${formatSummaryText(fmt)}` }

  return [client, captions, format, uploader, errors, frames]
}
