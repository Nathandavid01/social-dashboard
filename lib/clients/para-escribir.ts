import { esVivo } from './estado'

/**
 * A qué clientes hay que escribirles ideas, y en qué orden.
 *
 * Con los 66 activos en la lista, encontrar el de hoy era el problema; por eso
 * antes solo salían los agendados en el calendario de grabación. Ahora también
 * entra el que está marcado "próximo a grabar" o "sin contenido": son las dos
 * razones por las que se escriben ideas, y no siempre hay ya una sesión puesta
 * en el calendario cuando toca escribirlas.
 */

export interface ClienteEscribible {
  id: string
  name: string
  status: string
  /** Si tiene sesión en el calendario de grabación. Solo para mostrarlo. */
  agendado?: boolean
}

/** Los estados que por sí solos meten a un cliente en la lista. */
const ESTADOS_QUE_PIDEN_IDEAS = ['sin_contenido', 'proximo_a_grabar']

/** Primero quien se quedó sin contenido: ese ya va tarde. */
const PRIORIDAD = ['sin_contenido', 'proximo_a_grabar']

export function paraEscribirIdeas(
  clients: ClienteEscribible[],
  agendados: Set<string>,
): ClienteEscribible[] {
  return clients
    // Un cliente en onboarding o pausado no se graba, ni aunque alguien le haya
    // dejado una sesión puesta en el calendario.
    .filter((c) => esVivo(c.status))
    .filter((c) => agendados.has(c.id) || ESTADOS_QUE_PIDEN_IDEAS.includes(c.status))
    .map((c) => ({ ...c, agendado: agendados.has(c.id) }))
    .sort((a, b) => {
      const pa = PRIORIDAD.indexOf(a.status)
      const pb = PRIORIDAD.indexOf(b.status)
      // -1 (sin prioridad) va al final, no al principio.
      const ka = pa === -1 ? PRIORIDAD.length : pa
      const kb = pb === -1 ? PRIORIDAD.length : pb
      return ka !== kb ? ka - kb : a.name.localeCompare(b.name, 'es')
    })
}
