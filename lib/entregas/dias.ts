/**
 * La operación de Entregas es POR DÍA: el editor entrega para un día concreto
 * y cada día tiene su propio tablero completo.
 *
 * El día no se guarda aparte — se deriva de `publish_date`, que ya existe y es
 * lo que acaba recibiendo Metricool. Una columna nueva solo abriría la puerta a
 * que el día y la fecha real se contradigan.
 *
 * La semana va de lunes a DOMINGO. El domingo estuvo fuera al principio, y eso
 * mandaba a "Sin día" cualquier video con fecha en domingo —había 3, y 3
 * clientes con el domingo en su cadencia—, como si no tuviera fecha cuando sí
 * la tenía.
 */

export const DIAS = [
  { key: 1, label: 'Lunes', short: 'Lun' },
  { key: 2, label: 'Martes', short: 'Mar' },
  { key: 3, label: 'Miércoles', short: 'Mié' },
  { key: 4, label: 'Jueves', short: 'Jue' },
  { key: 5, label: 'Viernes', short: 'Vie' },
  { key: 6, label: 'Sábado', short: 'Sáb' },
  // Domingo es 0 en getDay(), pero cierra la semana: va el último.
  { key: 0, label: 'Domingo', short: 'Dom' },
] as const

export type DiaKey = (typeof DIAS)[number]['key']

/**
 * Posición dentro de la semana de trabajo: lunes 0 … domingo 6.
 *
 * La aritmética de fechas usa esto y no la clave, porque la clave viene de
 * getDay() —donde el domingo es 0— y sumarla directamente colocaría el domingo
 * antes del lunes.
 */
function posicion(dia: DiaKey): number {
  return dia === 0 ? 6 : dia - 1
}

/** Día de la semana de una fecha YYYY-MM-DD. */
export function diaDeFecha(publishDate: string | null | undefined): DiaKey | null {
  if (!publishDate) return null
  const [y, m, d] = publishDate.split('-').map(Number)
  if (!y || !m || !d) return null
  // Mediodía local: construir a medianoche puede caer en el día anterior según
  // la zona horaria, y entonces un lunes aparecería en domingo.
  return new Date(y, m - 1, d, 12).getDay() as DiaKey
}

/**
 * La PRÓXIMA fecha para ese día de la semana, en formato YYYY-MM-DD.
 * Hoy cuenta: entregar "lunes" un lunes significa hoy, no dentro de una semana.
 */
export function proximaFechaDelDia(dia: DiaKey, hoy: Date = new Date()): string {
  const base = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  const delta = (dia - base.getDay() + 7) % 7
  base.setDate(base.getDate() + delta)
  const mm = String(base.getMonth() + 1).padStart(2, '0')
  const dd = String(base.getDate()).padStart(2, '0')
  return `${base.getFullYear()}-${mm}-${dd}`
}

export function etiquetaDia(dia: DiaKey | null): string {
  return DIAS.find((d) => d.key === dia)?.label ?? 'Sin día'
}

/**
 * El día en que se publica lo que se entrega un día dado: el siguiente.
 *
 * La pestaña del tablero es el día en que el editor ENTREGA, no el de
 * publicación — se edita con un día de antelación.
 */
export function diaDePublicacion(dia: DiaKey): DiaKey {
  return ((dia + 1) % 7) as DiaKey
}

/**
 * La pestaña donde vive una tarjeta, a partir de su fecha de publicación: el
 * día anterior. Es la inversa exacta de diaDePublicacion.
 */
export function diaDeEntrega(publishDate: string | null | undefined): DiaKey | null {
  const publica = diaDeFecha(publishDate)
  if (publica === null) return null
  return ((publica + 6) % 7) as DiaKey
}

function sumarDias(iso: string, dias: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const f = new Date(y, m - 1, d, 12)
  f.setDate(f.getDate() + dias)
  const mm = String(f.getMonth() + 1).padStart(2, '0')
  const dd = String(f.getDate()).padStart(2, '0')
  return `${f.getFullYear()}-${mm}-${dd}`
}

/** El lunes de la semana natural de una fecha. El domingo la cierra. */
function lunesDeLaSemana(hoy: Date): string {
  const f = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 12)
  const dow = f.getDay()
  f.setDate(f.getDate() - (dow === 0 ? 6 : dow - 1))
  const mm = String(f.getMonth() + 1).padStart(2, '0')
  const dd = String(f.getDate()).padStart(2, '0')
  return `${f.getFullYear()}-${mm}-${dd}`
}

function lunesDeLaSemanaDeIso(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return lunesDeLaSemana(new Date(y, m - 1, d, 12))
}

/**
 * La fecha en que se ENTREGA, para un día y un adelanto en semanas.
 *
 * `semana` es cuánto va adelantado el editor: 0 la semana en curso, 1 la que
 * viene. Sin esto no había forma de entregar para más adelante —
 * proximaFechaDelDia siempre da la más cercana.
 */
export function fechaEntregaDelDia(dia: DiaKey, hoy: Date = new Date(), semana = 0): string {
  return sumarDias(lunesDeLaSemana(hoy), posicion(dia) + semana * 7)
}

/**
 * La fecha de publicación que se guarda al entregar: el día siguiente al de
 * entrega.
 *
 * Se cuenta DESDE el día de entrega y no buscando por separado la próxima fecha
 * del día de publicación: calculadas aparte, cada una redondea a su "próxima" y
 * pueden invertirse. Un jueves, entregar en la pestaña Miércoles daba como
 * publicación el jueves de HOY, antes de la propia entrega.
 */
export function fechaDeEntrega(dia: DiaKey, hoy: Date = new Date(), semana = 0): string {
  return sumarDias(fechaEntregaDelDia(dia, hoy, semana), 1)
}

/**
 * El rango de una semana de entrega, de lunes a domingo. Con solo "Esta semana"
 * no se sabe de qué fechas se está hablando, que es justo lo que hace falta
 * cuando se trabaja adelantado.
 */
export function rangoSemana(hoy: Date = new Date(), semana = 0): { desde: string; hasta: string } {
  return {
    desde: fechaEntregaDelDia(1, hoy, semana),
    hasta: fechaEntregaDelDia(0, hoy, semana),
  }
}

function diffEnSemanas(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  const ms = new Date(ay, am - 1, ad, 12).getTime() - new Date(by, bm - 1, bd, 12).getTime()
  return Math.round(ms / (7 * 24 * 60 * 60 * 1000))
}

/**
 * Cuánto adelantado va un video: 0 la semana en curso, 1 la que viene, negativo
 * si ya pasó. Es la inversa exacta de fechaDeEntrega, para que lo guardado
 * vuelva a leerse donde se entregó.
 *
 * Se compara por la fecha de ENTREGA y por el lunes de cada semana natural: así
 * los siete días de una misma semana dan siempre el mismo número, que es lo que
 * la etiqueta del selector promete.
 */
export function offsetSemana(publishDate: string | null | undefined, hoy: Date = new Date()): number | null {
  if (!publishDate || diaDeEntrega(publishDate) === null) return null
  const entrega = sumarDias(publishDate, -1)
  return diffEnSemanas(lunesDeLaSemanaDeIso(entrega), lunesDeLaSemana(hoy))
}

/**
 * Desde qué lado se mira la fecha en cada tablero.
 *
 * `entrega` — Revisión: el editor piensa "cuándo entrego", y publica al día
 *   siguiente.
 * `publicacion` — Copy y Publicación: ahí se piensa en la cadencia del cliente
 *   y en lo que recibe Metricool, que es cuándo se publica. La Guira publica
 *   lunes, miércoles y viernes; verla en domingo, martes y jueves no se
 *   entendía.
 */
export type ModoDia = 'entrega' | 'publicacion'

/** La pestaña donde vive una tarjeta, según desde dónde se mire. */
export function diaDeTablero(
  publishDate: string | null | undefined,
  modo: ModoDia,
): DiaKey | null {
  return modo === 'publicacion' ? diaDeFecha(publishDate) : diaDeEntrega(publishDate)
}

/**
 * La semana de una tarjeta, según el modo. En modo publicación se cuenta por la
 * fecha real; en modo entrega, por el día anterior. En el borde del domingo los
 * dos difieren —publicar el lunes es entregar el domingo, que ya es otra
 * semana— y eso es correcto: cada pantalla cuenta lo suyo.
 */
export function offsetSemanaTablero(
  publishDate: string | null | undefined,
  modo: ModoDia,
  hoy: Date = new Date(),
): number | null {
  if (modo === 'entrega') return offsetSemana(publishDate, hoy)
  if (!publishDate || diaDeFecha(publishDate) === null) return null
  return diffEnSemanas(lunesDeLaSemanaDeIso(publishDate), lunesDeLaSemana(hoy))
}
