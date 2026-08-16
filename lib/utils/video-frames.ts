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
 * efectivo al toparse con FRAME_CHUNK_SIZE (presupuesto de payload/latencia).
 */
export const FRAME_FPS = 4
/**
 * Tope de frames POR REQUEST — y tamaño de cada chunk que el cliente envía
 * por POST (frameTimestamps() ya limita a esto por defecto, así que un solo
 * POST siempre cabe en un chunk sin necesitar un segundo tope separado).
 * Medido en producción REAL (video de Arasibo, 768px lado largo, q0.7): 71
 * fotogramas = 3.54MB de cable → ~50KB por fotograma, no ~46KB. A 90 frames
 * eso son ~4.5MB — por ENCIMA de FRAME_BUDGET_BYTES (3.5MB), lo que hacía que
 * capFramesAndTimestampsToBudget recortara ~20 frames del final de cada chunk
 * en silencio. 64 × ~50KB ≈ 3.2MB, con margen para el resto del JSON. DEBE
 * moverse en lockstep con MAX_FRAMES en app/api/video-analysis/route.ts.
 */
export const FRAME_CHUNK_SIZE = 64
/**
 * Tope duro GLOBAL de frames por video (60s a 4fps): sin esto un video
 * de varios minutos generaría decenas de chunks y de llamadas a Grok.
 * frameTimestamps() puede generar hasta este valor cuando se le pide
 * explícitamente (el troceado por request lo aplica FRAME_CHUNK_SIZE, no
 * el muestreo).
 */
export const FRAME_HARD_MAX = 240
export const FRAME_MAX_SIDE = 768
export const FRAME_JPEG_QUALITY = 0.7
/**
 * Presupuesto de BYTES DE CABLE: la suma de `.length` de las data-URIs tal
 * como se serializan en el body JSON (no el tamaño decodificado — la base64
 * pesa ~4/3 de eso). Vercel corta el body ~4.5 MB; este margen deja espacio
 * para el resto del JSON (prompt, timestamps, etc).
 */
export const FRAME_BUDGET_BYTES = 3_500_000

/**
 * `count` timestamps equiespaciados en (0, duration), sin duplicados. La
 * matemática pura que comparten `frameTimestamps` (muestreo por fps) y
 * cualquier caller que ya sabe cuántos frames quiere de antemano — como la
 * tira de escenas (5 fijos, no un fps). Una sola implementación evita que
 * las dos deriven la misma fórmula por separado y se desincronicen.
 */
export function evenTimestamps(durationSeconds: number, count: number): number[] {
  if (!(durationSeconds > 0) || count < 1) return []
  const step = durationSeconds / (count + 1)
  const ts = Array.from({ length: count }, (_, i) => step * (i + 1))
  return Array.from(new Set(ts)).filter((t) => t > 0 && t < durationSeconds)
}

/**
 * Timestamps equiespaciados en (0, duration), muestreados a `fps` con tope
 * `maxCount`. Para videos largos el fps efectivo baja (12s*4fps=48=tope; un
 * video de 60s cae a ~0.8fps real) — es el trade-off de mantener el payload
 * dentro de presupuesto.
 */
export function frameTimestamps(durationSeconds: number, fps = FRAME_FPS, maxCount = FRAME_CHUNK_SIZE): number[] {
  if (!(durationSeconds > 0) || fps < 1 || maxCount < 1) return []
  const count = Math.min(Math.ceil(durationSeconds * fps), maxCount)
  return evenTimestamps(durationSeconds, count)
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
 * Recorta la lista de data-URIs (desde el final) hasta caber en el presupuesto,
 * medido en bytes de cable (longitud de la cadena tal como viaja en el JSON,
 * NO el tamaño decodificado — la base64 serializada es ~4/3 más grande).
 * El primero siempre se conserva: un solo frame ya permite leer el caption quemado.
 */
export function capFramesToBudget(frames: string[], maxTotalBytes = FRAME_BUDGET_BYTES): string[] {
  const bytes = (s: string) => s.length
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

/**
 * Trocea frames+timestamps en grupos de `size` para videos largos: cada
 * grupo es un POST independiente y secuencial a /api/video-analysis
 * (ver video-analysis-client.ts). Pura — sin red, sin async.
 */
export function chunkFrames(
  frames: string[],
  timestamps: number[],
  size = FRAME_CHUNK_SIZE,
): { frames: string[]; timestamps: number[] }[] {
  const out: { frames: string[]; timestamps: number[] }[] = []
  for (let i = 0; i < frames.length; i += size) {
    out.push({ frames: frames.slice(i, i + size), timestamps: timestamps.slice(i, i + size) })
  }
  return out
}
