/**
 * Matemática pura para la extracción de frames del video editado (QC IA).
 * La captura real con <video>+canvas vive en video-frames-dom.ts; aquí solo
 * hay funciones sin DOM para poder testearlas sin mocks.
 */

/**
 * Muestreo por densidad, no por conteo fijo: los captions quemados cambian
 * cada ~1s o menos, así que 8 fotogramas equiespaciados se saltan errores
 * reales (verificado en producción: video de 13s, 8 frames → 0 errores;
 * 53 frames (~4fps) → 3 errores reales, uno visible medio segundo).
 * A 4 fps un video de hasta 12s cabe entero; videos más largos bajan el fps
 * efectivo al toparse con FRAME_MAX_COUNT (presupuesto de payload/latencia).
 */
export const FRAME_FPS = 4
export const FRAME_MAX_COUNT = 48
export const FRAME_MAX_SIDE = 768
export const FRAME_JPEG_QUALITY = 0.7
/** Vercel corta el body ~4.5 MB; margen para JSON + resto del payload. */
export const FRAME_BUDGET_BYTES = 3_500_000

/**
 * Timestamps equiespaciados en (0, duration), muestreados a `fps` con tope
 * `maxCount`. Para videos largos el fps efectivo baja (12s*4fps=48=tope; un
 * video de 60s cae a ~0.8fps real) — es el trade-off de mantener el payload
 * dentro de presupuesto.
 */
export function frameTimestamps(durationSeconds: number, fps = FRAME_FPS, maxCount = FRAME_MAX_COUNT): number[] {
  if (!(durationSeconds > 0) || fps < 1 || maxCount < 1) return []
  const count = Math.min(Math.ceil(durationSeconds * fps), maxCount)
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

/**
 * Igual que capFramesToBudget pero recorta timestamps en paralelo — el
 * caller necesita que frames[i] y timestamps[i] sigan correspondiéndose
 * después del recorte.
 */
export function capFramesAndTimestampsToBudget(
  frames: string[],
  timestamps: number[],
  maxTotalBytes = FRAME_BUDGET_BYTES,
): { frames: string[]; timestamps: number[] } {
  const capped = capFramesToBudget(frames, maxTotalBytes)
  return { frames: capped, timestamps: timestamps.slice(0, capped.length) }
}
