import type { UserRole } from '@/lib/supabase/types'

/**
 * Lo que a cada persona le toca hacer, de un vistazo.
 *
 * Mi día enseñaba la lista entera de trabajo libre del equipo: 34 videos, 32 de
 * ellos atrasados de hace un mes, todos con "graba el video". Eso no es "lo que
 * tengo que hacer hoy", es un backlog — y una lista de 32 filas no se lee, se
 * ignora.
 *
 * Aquí solo números accionables, filtrados por rol y sin ceros: si no hay nada
 * pendiente, no se enseña nada.
 */

export interface DatosPendientes {
  /** Esperando revisión del equipo. */
  porRevisar: number
  /** Devueltos al editor con cambios. */
  devueltos: number
  /** Aprobados sin copy escrito. */
  esperandoCopy: number
  /** Con copy, listos para mandar a Metricool. */
  listosMetricool: number
  grabacionesProximas: number
  ideasSinGrabar: number
}

export interface Pendiente {
  key: keyof DatosPendientes
  label: string
  count: number
  href: string
  /** `urgente` es lo que bloquea a otra persona o es retrabajo parado. */
  tone: 'urgente' | 'normal'
}

interface Def {
  key: keyof DatosPendientes
  label: (n: number) => string
  href: string
  tone: Pendiente['tone']
}

const DEFS: Record<keyof DatosPendientes, Def> = {
  porRevisar: {
    key: 'porRevisar',
    label: (n) => `video${n === 1 ? '' : 's'} esperando tu revisión`,
    href: '/revision',
    tone: 'urgente',
  },
  devueltos: {
    key: 'devueltos',
    label: (n) => `video${n === 1 ? '' : 's'} con cambios pedidos`,
    href: '/revision',
    tone: 'urgente',
  },
  esperandoCopy: {
    key: 'esperandoCopy',
    label: (n) => `video${n === 1 ? '' : 's'} esperando el copy`,
    href: '/entregas',
    tone: 'urgente',
  },
  listosMetricool: {
    key: 'listosMetricool',
    label: (n) => `listo${n === 1 ? '' : 's'} para enviar a Metricool`,
    href: '/entregas',
    tone: 'normal',
  },
  grabacionesProximas: {
    key: 'grabacionesProximas',
    label: (n) => `grabación${n === 1 ? '' : 'es'} agendada${n === 1 ? '' : 's'}`,
    href: '/recording-calendar',
    tone: 'normal',
  },
  ideasSinGrabar: {
    key: 'ideasSinGrabar',
    label: (n) => `idea${n === 1 ? '' : 's'} en el banco sin grabar`,
    href: '/onsite',
    tone: 'normal',
  },
}

/**
 * Qué ve cada rol, en orden. Solo lo que esa persona puede ABRIR: un editor no
 * tiene entregas.read, así que enseñarle "3 esperando copy" sería mandarlo a
 * una pantalla que le da error.
 */
const POR_ROL: Record<string, (keyof DatosPendientes)[]> = {
  owner: ['porRevisar', 'devueltos', 'esperandoCopy', 'listosMetricool', 'grabacionesProximas'],
  supervisor: ['porRevisar', 'devueltos', 'esperandoCopy', 'listosMetricool', 'grabacionesProximas'],
  // Solo revision.read: su trabajo es entregar y corregir.
  editor: ['devueltos'],
  disenador: ['devueltos'],
  copy: ['esperandoCopy', 'listosMetricool'],
  video: ['grabacionesProximas', 'ideasSinGrabar'],
  team_member: ['devueltos'],
}

export function pendientesPara(
  role: UserRole | null | undefined,
  datos: DatosPendientes,
): Pendiente[] {
  const claves = POR_ROL[role ?? ''] ?? []
  return claves
    // Sin ceros: una tarjeta que dice "0" ocupa sitio y no pide nada.
    .filter((k) => datos[k] > 0)
    .map((k) => {
      const d = DEFS[k]
      return { key: k, label: d.label(datos[k]), count: datos[k], href: d.href, tone: d.tone }
    })
}
