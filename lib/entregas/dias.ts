/**
 * La operación de Entregas es POR DÍA: el editor entrega para un día concreto
 * y cada día tiene su propio tablero completo.
 *
 * El día no se guarda aparte — se deriva de `publish_date`, que ya existe y es
 * lo que acaba recibiendo Metricool. Una columna nueva solo abriría la puerta a
 * que el día y la fecha real se contradigan.
 */

export const DIAS = [
  { key: 1, label: 'Lunes', short: 'Lun' },
  { key: 2, label: 'Martes', short: 'Mar' },
  { key: 3, label: 'Miércoles', short: 'Mié' },
  { key: 4, label: 'Jueves', short: 'Jue' },
  { key: 5, label: 'Viernes', short: 'Vie' },
  { key: 6, label: 'Sábado', short: 'Sáb' },
] as const

export type DiaKey = (typeof DIAS)[number]['key']

/** Día de la semana de una fecha YYYY-MM-DD. Domingo (0) queda fuera. */
export function diaDeFecha(publishDate: string | null | undefined): DiaKey | null {
  if (!publishDate) return null
  const [y, m, d] = publishDate.split('-').map(Number)
  if (!y || !m || !d) return null
  // Mediodía local: construir a medianoche puede caer en el día anterior según
  // la zona horaria, y entonces un lunes aparecería en domingo.
  const day = new Date(y, m - 1, d, 12).getDay()
  return day >= 1 && day <= 6 ? (day as DiaKey) : null
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
 * publicación — se edita con un día de antelación. El sábado salta el domingo,
 * que no existe en el tablero ni en la cadencia.
 */
export function diaDePublicacion(dia: DiaKey): DiaKey {
  return dia === 6 ? 1 : ((dia + 1) as DiaKey)
}

/**
 * La pestaña donde vive una tarjeta, a partir de su fecha de publicación: el
 * día anterior. Es la inversa exacta de diaDePublicacion.
 *
 * Un domingo no cae en ninguna pestaña — nadie entrega para el domingo.
 */
export function diaDeEntrega(publishDate: string | null | undefined): DiaKey | null {
  const publica = diaDeFecha(publishDate)
  if (publica === null) return null
  return publica === 1 ? 6 : ((publica - 1) as DiaKey)
}

/**
 * La fecha que se guarda al entregar desde una pestaña: la próxima del día en
 * que eso se publica. Se guarda la fecha real de publicación porque es lo que
 * acaba recibiendo Metricool; la pestaña se deriva de ella con diaDeEntrega.
 */
function sumarDias(iso: string, dias: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const f = new Date(y, m - 1, d, 12)
  f.setDate(f.getDate() + dias)
  const mm = String(f.getMonth() + 1).padStart(2, '0')
  const dd = String(f.getDate()).padStart(2, '0')
  return `${f.getFullYear()}-${mm}-${dd}`
}

/**
 * La fecha en que se ENTREGA, para un día y un adelanto en semanas.
 *
 * `semana` es cuánto va adelantado el editor: 0 esta semana, 1 la que viene.
 * Sin esto no había forma de entregar para más adelante — proximaFechaDelDia
 * siempre da la más cercana.
 */
export function fechaEntregaDelDia(dia: DiaKey, hoy: Date = new Date(), semana = 0): string {
  return sumarDias(lunesDeLaSemana(hoy), (dia - 1) + semana * 7)
}

/**
 * El lunes de la semana de trabajo de una fecha.
 *
 * El domingo salta a la semana que empieza al día siguiente: no se entrega en
 * domingo, así que la semana que acaba de terminar ya no sirve de nada. Sin
 * esto, el domingo el tablero abría en una semana entera vencida y había que
 * pulsar la flecha a mano.
 */
function lunesDeLaSemana(hoy: Date): string {
  const f = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 12)
  const dow = f.getDay()
  f.setDate(f.getDate() + (dow === 0 ? 1 : -(dow - 1)))
  const mm = String(f.getMonth() + 1).padStart(2, '0')
  const dd = String(f.getDate()).padStart(2, '0')
  return `${f.getFullYear()}-${mm}-${dd}`
}

/**
 * El rango de una semana de entrega, de lunes a sábado. Con solo "Esta semana"
 * no se sabe de qué fechas se está hablando, que es justo lo que hace falta
 * cuando se trabaja adelantado.
 */
export function rangoSemana(hoy: Date = new Date(), semana = 0): { desde: string; hasta: string } {
  return {
    desde: fechaEntregaDelDia(1, hoy, semana),
    hasta: fechaEntregaDelDia(6, hoy, semana),
  }
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
  // El sábado salta el domingo: publica el lunes.
  return sumarDias(fechaEntregaDelDia(dia, hoy, semana), dia === 6 ? 2 : 1)
}

function lunesDeLaSemanaDeIso(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return lunesDeLaSemana(new Date(y, m - 1, d, 12))
}

function diffEnSemanas(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  const ms = new Date(ay, am - 1, ad, 12).getTime() - new Date(by, bm - 1, bd, 12).getTime()
  return Math.round(ms / (7 * 24 * 60 * 60 * 1000))
}

/**
 * Cuánto adelantado va un video: 0 la próxima vez que toca ese día, 1 la
 * siguiente, negativo si ya pasó.
 *
 * Se compara contra la próxima fecha DE SU MISMO DÍA, no contra el lunes de la
 * semana natural. "Esta semana" no es una semana del calendario: un jueves, el
 * próximo jueves es hoy y el próximo lunes ya es de la semana que viene, así
 * que medir por semanas naturales daba desfases de uno según el día.
 *
 * Es la inversa exacta de fechaDeEntrega, para que lo guardado vuelva a leerse
 * donde se entregó.
 */
export function offsetSemana(publishDate: string | null | undefined, hoy: Date = new Date()): number | null {
  const dia = diaDeEntrega(publishDate)
  if (dia === null || !publishDate) return null
  // De la fecha de publicación a la de entrega: el sábado publica el lunes.
  const entrega = sumarDias(publishDate, dia === 6 ? -2 : -1)
  // Por el lunes de cada semana natural: así los seis días de una misma semana
  // dan siempre el mismo número, que es lo que la etiqueta promete.
  return diffEnSemanas(lunesDeLaSemanaDeIso(entrega), lunesDeLaSemana(hoy))
}
