/**
 * La primera llamada corre al momento; las que llegan dentro de `ms` se
 * juntan en una sola al cerrar la ventana. `cancel` descarta la pendiente.
 */
export function createThrottle(fn: () => void, ms: number): { call(): void; cancel(): void } {
  let lastAt = -Infinity
  let timer: ReturnType<typeof setTimeout> | null = null
  const fire = () => {
    timer = null
    lastAt = Date.now()
    fn()
  }
  return {
    call() {
      if (timer) return
      const wait = lastAt + ms - Date.now()
      if (wait <= 0) fire()
      else timer = setTimeout(fire, wait)
    },
    cancel() {
      if (timer) clearTimeout(timer)
      timer = null
    },
  }
}
