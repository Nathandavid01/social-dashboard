/**
 * Matemática pura para la extracción de frames del video editado (QC IA).
 * La captura real con <video>+canvas vive en video-frames-dom.ts; aquí solo
 * hay funciones sin DOM para poder testearlas sin mocks.
 */

export const FRAME_COUNT = 8
export const FRAME_MAX_SIDE = 960
export const FRAME_JPEG_QUALITY = 0.7
/** Vercel corta el body ~4.5 MB; margen para JSON + resto del payload. */
export const FRAME_BUDGET_BYTES = 3_500_000

/** N timestamps equiespaciados en (0, duration), sin el frame 0 ni el final. */
export function frameTimestamps(durationSeconds: number, count = FRAME_COUNT): number[] {
  if (!(durationSeconds > 0) || count < 1) return []
  const step = durationSeconds / (count + 1)
  const ts = Array.from({ length: count }, (_, i) => step * (i + 1))
  return Array.from(new Set(ts)).filter((t) => t > 0 && t < durationSeconds)
}

/** Reduce al lado largo maxSide manteniendo aspecto; nunca agranda. */
export function scaleDimensions(
  w: number,
  h: number,
  maxSide = FRAME_MAX_SIDE,
): { width: number; height: number } {
  const largest = Math.max(w, h)
  if (largest <= maxSide) return { width: w, height: h }
  const f = maxSide / largest
  return { width: Math.round(w * f), height: Math.round(h * f) }
}

/**
 * Recorta la lista de data-URIs (desde el final) hasta caber en el presupuesto.
 * El primero siempre se conserva: un solo frame ya permite leer el caption quemado.
 */
export function capFramesToBudget(frames: string[], maxTotalBytes = FRAME_BUDGET_BYTES): string[] {
  const bytes = (s: string) => Math.floor((s.length * 3) / 4)
  const out = [...frames]
  while (out.length > 1 && out.reduce((n, f) => n + bytes(f), 0) > maxTotalBytes) out.pop()
  return out
}
