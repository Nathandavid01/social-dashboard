import type { EntregaStageKey } from './batches'

/**
 * La marca de "el cliente ya respondió" en la tarjeta del tablero.
 *
 * El cliente puede aprobar antes de que el copy esté escrito. La tarjeta se
 * queda en Copy —eso ya funcionaba, porque ideaStage exige el caption para
 * pasar a Publicación— pero no lo decía en ninguna parte: la única señal era un
 * contador diminuto dentro del botón del enlace.
 */

export type EstadoCliente = 'pending' | 'approved' | 'rejected'

export interface MarcaCliente {
  label: string
  tone: 'ok' | 'parcial' | 'cambios'
}

export function marcaAprobacionCliente(
  estados: EstadoCliente[],
  stage: EntregaStageKey,
): MarcaCliente | null {
  // En Editado y Revisión la tarjeta ya trae su propia caja de correcciones;
  // dos avisos del mismo hecho compiten entre sí.
  if (stage !== 'copy' && stage !== 'publication') return null
  if (estados.length === 0) return null

  const rechazados = estados.filter((s) => s === 'rejected').length
  // Un rechazo manda sobre todo lo demás: hay trabajo que rehacer, y eso pesa
  // más que cuántos se aprobaron.
  if (rechazados > 0) {
    return { label: `El cliente pidió cambios en ${rechazados}`, tone: 'cambios' }
  }

  const aprobados = estados.filter((s) => s === 'approved').length
  if (aprobados === 0) return null

  if (aprobados === estados.length) {
    return {
      label: stage === 'copy'
        ? 'Aprobado por el cliente · falta el copy'
        : 'Aprobado por el cliente',
      tone: 'ok',
    }
  }
  return { label: `${aprobados} de ${estados.length} aprobados por el cliente`, tone: 'parcial' }
}
