'use client'

import { healVideoThumbs } from './video-postupload-client'
import { useUploadStore } from '@/lib/stores/upload-store'

/**
 * Cura, una vez, la carátula de un crudo que se quedó sin ella: la primera
 * tarjeta que lo muestra la genera y la guarda, y desde ahí sale del camino
 * barato (thumb_keys). Varias tarjetas del mismo video comparten el trabajo, y
 * si el browser no puede decodificarlo no se vuelve a bajar en cada visita:
 * se reintenta pasado HEAL_RETRY_AFTER_MS. Lo que no se pudo guardar tampoco
 * se reintenta en cada visita. No arranca mientras hay subidas en curso: la
 * carátula baja el video y ocuparía la fila de decodificación (una a la vez)
 * que usan las carátulas de lo que se está subiendo.
 */
export const HEAL_RETRY_AFTER_MS = 6 * 60 * 60 * 1000

/**
 * Recién subido, la carátula la está haciendo quien lo subió; curarla desde
 * otra pestaña (el tablero la muestra en vivo) la haría dos veces.
 */
export const HEAL_MIN_AGE_MS = 15 * 60 * 1000

/** ¿Pasó el tiempo para curarla? Sin fecha (o ilegible) = video viejo. */
export function oldEnoughToHeal(uploadedAt: string | null | undefined, now: number = Date.now()): boolean {
  const at = uploadedAt ? Date.parse(uploadedAt) : NaN
  return !Number.isFinite(at) || now - at >= HEAL_MIN_AGE_MS
}

type HealFn = (videoId: string) => Promise<{ cover: string | null; saved: boolean }>

const inFlight = new Map<string, Promise<string | null>>()

function failedKey(videoId: string): string {
  return `nm:caratula-fallida:${videoId}`
}

function failedRecently(videoId: string, now: number): boolean {
  try {
    const at = Number(window.localStorage.getItem(failedKey(videoId)))
    return at > 0 && now - at < HEAL_RETRY_AFTER_MS
  } catch {
    return false
  }
}

/** Anota el fallo (o lo borra al curarla, para no acumular claves). */
function rememberOutcome(videoId: string, saved: boolean, now: number): void {
  try {
    if (saved) window.localStorage.removeItem(failedKey(videoId))
    else window.localStorage.setItem(failedKey(videoId), String(now))
  } catch {
    // Sin storage (modo privado): se reintentará en la próxima visita.
  }
}

export function healVideoCover(
  videoId: string,
  deps: { heal?: HealFn; now?: () => number; busy?: () => boolean } = {},
): Promise<string | null> {
  const now = deps.now ?? Date.now
  const busy = deps.busy ?? (() => useUploadStore.getState().hasActiveUploads())
  if (busy() || failedRecently(videoId, now())) return Promise.resolve(null)
  const pending = inFlight.get(videoId)
  if (pending) return pending

  const heal = deps.heal ?? healVideoThumbs
  // Sin guardar (no decodifica, o quien mira no puede subir) también cuenta:
  // si no, cada visita volvería a bajar y decodificar el mismo video.
  const job = heal(videoId)
    .catch(() => ({ cover: null, saved: false }))
    .then((res) => {
      rememberOutcome(videoId, res.saved, now())
      return res.cover
    })
    .finally(() => inFlight.delete(videoId))
  inFlight.set(videoId, job)
  return job
}

export function __resetCoverHealForTests(): void {
  inFlight.clear()
}
