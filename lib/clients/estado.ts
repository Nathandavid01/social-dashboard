/**
 * El estado de un cliente — el campo que gobierna dónde aparece en el dashboard.
 *
 * Se pone a mano en la ficha del cliente. Los cinco estados viven aquí y en
 * ningún otro sitio: antes "cliente vivo" era `.eq('status', 'active')` repetido
 * en 16 consultas, así que añadir un estado nuevo lo sacaba en silencio de
 * cadencia, Metricool, captions y el plan semanal. Ahora esas consultas leen
 * ESTADOS_VIVOS, que se deriva de esta tabla.
 */

export interface ClientEstadoDef {
  key: string
  label: string
  /**
   * Si cuenta como cliente en producción. "Próximo a grabar" y "sin contenido"
   * describen en qué punto está el trabajo, no si el cliente sigue con nosotros:
   * los tres siguen entrando en el flujo de publicación. Onboarding y pausado no
   * —igual que hoy—, uno porque aún no ha empezado y el otro porque paró.
   */
  vivo: boolean
  /** Clases del badge. */
  tone: string
  /** Qué significa, para el desplegable de la ficha. */
  hint: string
}

/** En el orden en que se ofrecen en el desplegable. */
export const CLIENT_ESTADOS: ClientEstadoDef[] = [
  {
    key: 'active',
    label: 'Activo',
    vivo: true,
    tone: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/25',
    hint: 'Con contenido en marcha y publicando.',
  },
  {
    key: 'proximo_a_grabar',
    label: 'Próximo a grabar',
    vivo: true,
    tone: 'text-amber-600 bg-amber-500/10 border-amber-500/25',
    hint: 'Toca grabarle: sale primero en On Site y en escribir ideas.',
  },
  {
    key: 'sin_contenido',
    label: 'Sin contenido',
    vivo: true,
    tone: 'text-red-600 bg-red-500/10 border-red-500/25',
    hint: 'Se le acabó el banco. Hay que escribirle ideas y grabar.',
  },
  {
    key: 'onboarding',
    label: 'Onboarding',
    vivo: false,
    tone: 'text-sky-600 bg-sky-500/10 border-sky-500/25',
    hint: 'Entrando. Todavía no publica.',
  },
  {
    key: 'paused',
    label: 'Pausado',
    vivo: false,
    tone: 'text-muted-foreground bg-muted border-border',
    hint: 'Contrato en pausa. Fuera del flujo hasta que vuelva.',
  },
]

export type ClientEstado = (typeof CLIENT_ESTADOS)[number]['key']

const POR_CLAVE = new Map(CLIENT_ESTADOS.map((e) => [e.key, e]))

/**
 * Los estados que cuentan como cliente en producción. Se deriva de la tabla a
 * propósito: escrita a mano se queda desincronizada al añadir un estado.
 */
export const ESTADOS_VIVOS: string[] = CLIENT_ESTADOS.filter((e) => e.vivo).map((e) => e.key)

/** Si este cliente entra en cadencia, Metricool, captions y el plan semanal. */
export function esVivo(status: string | null | undefined): boolean {
  return status != null && ESTADOS_VIVOS.includes(status)
}

/**
 * La etiqueta en español. Un estado que no conocemos se muestra tal cual y no
 * como "undefined": si algún día aparece uno nuevo en la base de datos, mejor
 * verlo que esconderlo.
 */
export function estadoLabel(status: string | null | undefined): string {
  if (status == null || status === '') return '—'
  return POR_CLAVE.get(status)?.label ?? status
}

/** Clases del badge. Uno desconocido sale neutro, nunca sin clases. */
export function estadoTone(status: string | null | undefined): string {
  return POR_CLAVE.get(status ?? '')?.tone ?? 'text-muted-foreground bg-muted border-border'
}

export function esEstadoValido(status: string | null | undefined): boolean {
  return status != null && POR_CLAVE.has(status)
}
