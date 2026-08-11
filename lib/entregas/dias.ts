/**
 * La operación de Entregas es POR DÍA: cada día tiene su propio tablero
 * completo.
 *
 * El día no se guarda aparte — se deriva de `publish_date`, que ya existe y es
 * lo que acaba recibiendo Metricool. Una columna nueva solo abriría la puerta a
 * que el día y la fecha real se contradigan.
 *
 * La pestaña de una tarjeta es el día en que el video SE PUBLICA, y punto.
 * Hubo una época en que /revision la corría un día atrás —la pestaña era el día
 * de ENTREGA, porque la fecha salía de la pestaña abierta y se editaba con un
 * día de antelación— mientras /entregas usaba la fecha real. El mismo video
 * salía en pestañas distintas según la pantalla, y el equipo lo reportó como
 * que los videos se cruzaban. Desde que el editor elige la fecha video a video
 * (ver fecha-video.ts) esa traducción no tiene dueño: la fecha que él eligió es
 * la de publicación, y es la única que se usa en todas partes.
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
 * El día en que hay que tener LISTO lo que se publica un día dado: el anterior.
 *
 * Es un dato informativo de la columna —"esto sale el martes, tenlo el lunes"—,
 * nunca el criterio para colocar la tarjeta. Colocarla por aquí es lo que hacía
 * que un video de lunes apareciera en la pestaña del domingo.
 */
export function diaListo(dia: DiaKey): DiaKey {
  return ((dia + 6) % 7) as DiaKey
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
 * La fecha de publicación de una columna, para un día y un adelanto en semanas.
 *
 * `semana` es cuánto va adelantado el editor: 0 la semana en curso, 1 la que
 * viene. Sin esto no había forma de mirar más adelante — proximaFechaDelDia
 * siempre da la más cercana.
 */
export function fechaDelDia(dia: DiaKey, hoy: Date = new Date(), semana = 0): string {
  return sumarDias(lunesDeLaSemana(hoy), posicion(dia) + semana * 7)
}

/**
 * El día natural anterior a una fecha.
 *
 * Se cuenta sobre la fecha y no buscando el día anterior dentro de la semana:
 * el "listo" de un lunes es el domingo de la semana PASADA, y buscarlo por día
 * lo mandaba al domingo del final de la misma semana — seis días tarde.
 */
export function fechaAnterior(iso: string): string {
  return sumarDias(iso, -1)
}

/**
 * El rango de una semana, de lunes a domingo. Con solo "Esta semana" no se sabe
 * de qué fechas se está hablando, que es justo lo que hace falta cuando se
 * trabaja adelantado.
 */
export function rangoSemana(hoy: Date = new Date(), semana = 0): { desde: string; hasta: string } {
  return {
    desde: fechaDelDia(1, hoy, semana),
    hasta: fechaDelDia(0, hoy, semana),
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
 * si ya pasó. Es la inversa exacta de fechaDelDia, para que lo guardado vuelva
 * a leerse en la semana en que se ve.
 *
 * Se cuenta por la fecha de PUBLICACIÓN y por el lunes de cada semana natural:
 * así los siete días de una misma semana dan siempre el mismo número, que es lo
 * que la etiqueta del selector promete. Contarlo por el día anterior mandaba
 * todo lo que publica en lunes a la semana pasada.
 */
export function offsetSemanaDeFecha(
  publishDate: string | null | undefined,
  hoy: Date = new Date(),
): number | null {
  if (!publishDate || diaDeFecha(publishDate) === null) return null
  return diffEnSemanas(lunesDeLaSemanaDeIso(publishDate), lunesDeLaSemana(hoy))
}
