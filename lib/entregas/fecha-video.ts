import { etiquetaDia, diaDeFecha } from './dias'

/**
 * La fecha que el editor elige por video: el día en que se PUBLICA.
 *
 * Antes la fecha salía de la pestaña abierta y del selector de semana, lo que
 * obligaba a entrar en el día correcto antes de entregar y hacía imposible
 * subir en una sola tanda videos de días distintos. Ahora la dice el editor,
 * video a video.
 *
 * Es la fecha de publicación —lo que recibe Metricool y lo que el cliente
 * entiende por su cadencia— para que no haya que traducirla en ningún sitio.
 */

export interface CheckFecha {
  ok: boolean
  /** Se puede entregar igual; solo hay algo que conviene saber. */
  aviso: string | null
}

export function checkFechaVideo(iso: string, hoy: Date = new Date()): CheckFecha {
  if (!iso) return { ok: false, aviso: null }
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return { ok: false, aviso: null }
  const f = new Date(y, m - 1, d, 12)
  if (Number.isNaN(f.getTime())) return { ok: false, aviso: null }

  const hoyMed = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 12)
  // Una fecha pasada no se bloquea: puede ser trabajo atrasado que se entrega
  // tarde a propósito, y prohibirlo obligaría a inventarse una fecha falsa.
  if (f.getTime() < hoyMed.getTime()) {
    return { ok: true, aviso: 'Es una fecha pasada' }
  }
  return { ok: true, aviso: null }
}

/** "miércoles 5 ago" — el día de la semana es lo que se piensa al planificar. */
export function etiquetaFechaVideo(iso: string): string {
  if (!iso) return ''
  const dia = diaDeFecha(iso)
  if (dia === null) return ''
  const [y, m, d] = iso.split('-').map(Number)
  const corta = new Date(y, m - 1, d, 12).toLocaleDateString('es', { day: 'numeric', month: 'short' })
  return `${etiquetaDia(dia).toLowerCase()} ${corta}`
}
