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
