/**
 * La fecha de un video, escrita en su tarjeta.
 *
 * El tablero acumula lo atrasado en la semana en curso a propósito —seguir
 * pendiente es justo lo que hay que ver—, pero eso deja la pestaña "Lunes"
 * enseñando a la vez el video del 3 y el del 10. Sin la fecha en la tarjeta no
 * hay forma de distinguirlos, y así es como el equipo acabó diciendo que "los
 * videos se cruzan": no se cruzaban, es que no se podían verificar.
 *
 * Es `publish_date`: la fecha que el editor eligió al entregar y la que recibe
 * Metricool. Aquí no se traduce a ninguna otra.
 */

export type EstadoFechaTarjeta = 'sin-fecha' | 'atrasada' | 'hoy' | 'proxima' | 'otra-semana'

export interface FechaTarjeta {
  /** La fecha tal cual está guardada, para poder compararla sin reformatear. */
  iso: string | null
  /** 'mar 11 ago' — el día de la semana es lo que se piensa al planificar. */
  etiqueta: string
  estado: EstadoFechaTarjeta
  /** Lo que hay que saber sin abrir nada. null cuando no hay nada que avisar. */
  aviso: string | null
}

/**
 * Mediodía local: construir a medianoche cae en el día anterior según la zona
 * horaria, y entonces un lunes se enseñaría como domingo.
 */
function aMediodia(iso: string): Date | null {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return null
  const f = new Date(y, m - 1, d, 12)
  return Number.isNaN(f.getTime()) ? null : f
}

/** Sin puntos ni comas: el ICU escribe "mar." o "mar," según la versión. */
function limpio(s: string): string {
  return s.replace(/[.,]/g, '').trim()
}

function etiquetaDe(f: Date): string {
  const dia = limpio(f.toLocaleDateString('es', { weekday: 'short' })).toLowerCase()
  const resto = limpio(f.toLocaleDateString('es', { day: 'numeric', month: 'short' }))
  return `${dia} ${resto}`
}

/** El lunes de la semana natural. El domingo la cierra, no la abre. */
function lunesDe(f: Date): Date {
  const l = new Date(f.getFullYear(), f.getMonth(), f.getDate(), 12)
  const dow = l.getDay()
  l.setDate(l.getDate() - (dow === 0 ? 6 : dow - 1))
  return l
}

const DIA_MS = 24 * 60 * 60 * 1000

export function fechaTarjeta(
  publishDate: string | null | undefined,
  hoy: Date = new Date(),
): FechaTarjeta {
  const f = publishDate ? aMediodia(publishDate) : null
  if (!f) return { iso: null, etiqueta: 'Sin fecha', estado: 'sin-fecha', aviso: null }

  const etiqueta = etiquetaDe(f)
  const hoyMed = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 12)

  if (f.getTime() < hoyMed.getTime()) {
    // Atrasado antes que "de otra semana": un video vencido sigue pendiente, y
    // eso es lo primero que hay que ver aunque además sea de la semana pasada.
    return { iso: publishDate!, etiqueta, estado: 'atrasada', aviso: `Atrasado · era el ${etiqueta}` }
  }
  if (f.getTime() === hoyMed.getTime()) {
    return { iso: publishDate!, etiqueta, estado: 'hoy', aviso: null }
  }

  const semanas = Math.round((lunesDe(f).getTime() - lunesDe(hoyMed).getTime()) / (7 * DIA_MS))
  if (semanas > 0) {
    return {
      iso: publishDate!,
      etiqueta,
      estado: 'otra-semana',
      aviso: semanas === 1 ? 'Semana que viene' : `Dentro de ${semanas} semanas`,
    }
  }

  return { iso: publishDate!, etiqueta, estado: 'proxima', aviso: null }
}
