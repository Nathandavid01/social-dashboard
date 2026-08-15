/**
 * Matemática pura para la tira de 5 escenas: qué frames (ya extraídos por
 * video-frames-dom.ts para el QC IA) se usan como thumbnails. Sin DOM, sin
 * red — solo selección de índices, para poder testearla sin mocks.
 */

export const THUMB_COUNT = 5

/**
 * Selecciona `count` frames equiespaciados de `frames`, conservando siempre
 * el primero y el último (así la tira muestra principio y fin de la escena).
 * Si hay `count` o menos frames, los devuelve todos tal cual.
 */
export function pickThumbFrames(frames: string[], count = THUMB_COUNT): string[] {
  if (count <= 0 || frames.length === 0) return []
  if (frames.length <= count) return [...frames]
  if (count === 1) return [frames[0]]

  const step = (frames.length - 1) / (count - 1)
  const indices = Array.from({ length: count }, (_, i) => Math.round(i * step))
  // Dedup por si el redondeo colapsa dos índices vecinos (frames cortos).
  const unique = Array.from(new Set(indices))
  return unique.map((i) => frames[i])
}
