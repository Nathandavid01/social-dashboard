/**
 * Fila con N turnos (semáforo FIFO). Sin red ni DOM: la usan el motor de
 * subidas (cuántos archivos suben a la vez) y la decodificación de video en
 * el browser (una a la vez), y se prueba sola.
 *
 * Por qué existe (medido en prod, sep-2026): una tanda de 56 crudos arrancaba
 * los 56 a la vez — cada archivo iba a <1 Mbps y el primero aparecía a los
 * ~2 min; y 30 extracciones de carátula simultáneas pasaban el límite de
 * reproductores de video del browser, así que algunas salían sin carátula.
 */
export interface SlotQueue {
  /**
   * Espera turno, corre `task` y suelta el turno al terminar, falle o no.
   * Con `signal` abortado mientras espera, sale de la fila con AbortError.
   * `low`: trabajo de fondo que puede esperar — solo entra si no hay nadie
   * normal esperando (p.ej. curar una carátula vieja cede ante la de una subida).
   */
  run<T>(task: () => Promise<T>, signal?: AbortSignal, opts?: { low?: boolean }): Promise<T>
  /** ¿La próxima tarea entra sin esperar? */
  hasFree(): boolean
}

export function createSlotQueue(limit: number): SlotQueue {
  const max = Math.max(1, Math.floor(limit))
  let active = 0
  const queue: Array<() => void> = []
  const lowQueue: Array<() => void> = []

  function acquire(signal?: AbortSignal, low = false): Promise<void> {
    if (signal?.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'))
    if (active < max) {
      active++
      return Promise.resolve()
    }
    const line = low ? lowQueue : queue
    return new Promise((resolve, reject) => {
      const grant = () => {
        signal?.removeEventListener('abort', onAbort)
        resolve()
      }
      const onAbort = () => {
        line.splice(line.indexOf(grant), 1)
        reject(new DOMException('Aborted', 'AbortError'))
      }
      line.push(grant)
      signal?.addEventListener('abort', onAbort, { once: true })
    })
  }

  function release(): void {
    const next = queue.shift() ?? lowQueue.shift()
    // El turno pasa directo al siguiente: `active` no baja y vuelve a subir.
    if (next) next()
    else active--
  }

  return {
    async run(task, signal, opts) {
      await acquire(signal, opts?.low)
      try {
        return await task()
      } finally {
        release()
      }
    },
    hasFree: () => active < max,
  }
}
