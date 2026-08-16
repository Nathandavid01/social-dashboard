import type { UploadItem } from '@/lib/stores/upload-store'

/**
 * Shared Spanish, says-what's-happening copy per upload phase — used by both
 * the global dock and the per-video panel so the two never drift apart.
 * Never a mute progress bar: every phase has an explanation.
 */
export function uploadPhaseText(item: UploadItem): string {
  switch (item.phase) {
    case 'preparando':
      return 'Preparando…'
    case 'subiendo':
      return item.partsTotal > 1
        ? `Subiendo… ${item.pct}% · parte ${Math.min(item.partsDone + 1, item.partsTotal)} de ${item.partsTotal}`
        : `Subiendo… ${item.pct}%`
    case 'reintentando':
      return `Se cayó la conexión — reintentando (${item.attempt} de 5)…`
    case 'ensamblando':
      return 'Ensamblando el archivo'
    case 'registrando':
      return 'Registrando el video'
    case 'analizando':
      return 'La IA está viendo el video…'
    case 'listo':
      return 'Listo'
    case 'error':
      return item.error ? `Falló: ${item.error}` : 'Falló la subida'
    case 'cancelado':
      return 'Cancelado'
  }
}
