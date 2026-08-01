/**
 * Aprobación del cliente por enlace, para el flujo de Entregas.
 *
 * Flujo propio y separado del de Eric a propósito: su enlace vive en otra tabla,
 * su función de base de datos filtra por su bucket y su aprobación dispara el
 * envío automático a Metricool. Aquí la aprobación PARA en Publicación, y el
 * envío lo sigue dando una persona.
 *
 * Módulo puro: las reglas de vigencia y de voto viven aquí, no repartidas entre
 * la pantalla pública y el servidor, para que no puedan discrepar.
 */

/** Un enlace sin login es una credencial: caduca para limitar el daño. */
export const DIAS_DE_VIGENCIA = 7

export type DecisionCliente = 'approved' | 'rejected'

export interface EnlaceRevision {
  status: 'pending' | DecisionCliente
  /** ISO. null = sin caducidad. */
  expiresAt: string | null
  comment: string | null
  reviewerName: string | null
}

export type EstadoEnlace = 'sin_enlace' | 'esperando' | 'aprobado' | 'rechazado' | 'vencido'

/**
 * En qué punto está el enlace. Un voto ya emitido manda sobre la caducidad: que
 * el enlace venza no borra lo que el cliente decidió.
 */
export function estadoDelEnlace(e: EnlaceRevision | null, ahora: Date = new Date()): EstadoEnlace {
  if (!e) return 'sin_enlace'
  if (e.status === 'approved') return 'aprobado'
  if (e.status === 'rejected') return 'rechazado'
  if (e.expiresAt && new Date(e.expiresAt).getTime() <= ahora.getTime()) return 'vencido'
  return 'esperando'
}

/**
 * Si el enlace todavía acepta un voto.
 *
 * Un voto emitido no se cambia desde el enlace: si el cliente se arrepiente, se
 * genera uno nuevo. Sin esto, reenviar el mismo enlace podría revertir un
 * aprobado que ya movió la tarjeta.
 */
export function puedeVotar(e: EnlaceRevision | null, ahora: Date = new Date()): boolean {
  return estadoDelEnlace(e, ahora) === 'esperando'
}

/**
 * Valida y normaliza el comentario del cliente. Rechazar sin escribir nada no
 * vale: el editor recibiría la tarjeta de vuelta sin saber qué corregir, que es
 * el mismo fallo que ya arreglamos en la revisión interna.
 */
export function textoDecision(
  decision: DecisionCliente,
  comment: string,
): { ok: boolean; comment: string | null; error?: string } {
  const limpio = comment.trim()
  if (decision === 'rejected' && limpio.length === 0) {
    return { ok: false, comment: null, error: 'Escribe qué hay que cambiar.' }
  }
  return { ok: true, comment: limpio || null }
}
