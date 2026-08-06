/**
 * Qué segundos del video se capturan como frame.
 *
 * Puro a propósito: la captura en sí necesita un <video> y un <canvas> (solo
 * navegador), pero decidir DÓNDE mirar es aritmética y se puede probar.
 */

/** Cada cuánto se mira el video, en segundos. */
export const INTERVALO_SEG = 1.2

/**
 * Tope duro de frames. Cada frame es una imagen que se paga en la llamada de
 * visión, así que el intervalo es una preferencia y esto es el límite.
 */
export const MAX_FRAMES = 24

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Los segundos a capturar, en orden.
 *
 * Con un video corto sale el intervalo pedido tal cual. Cuando no cabe, se
 * ESTIRA el intervalo para cubrir el video entero en vez de cortar en el frame
 * 24 — los errores de subtítulo del final son tan reales como los del
 * principio, y truncar dejaría medio video sin revisar en silencio.
 *
 * Una duración inservible (0, negativa, NaN, Infinity — un <video> al que aún
 * no le cargó la metadata) devuelve [] para que el llamador avise.
 */
export function momentosDeMuestreo(
  duracionSeg: number,
  opts: { intervalo?: number; tope?: number } = {},
): number[] {
  if (!Number.isFinite(duracionSeg) || duracionSeg <= 0) return []

  const intervalo = opts.intervalo ?? INTERVALO_SEG
  const tope = opts.tope ?? MAX_FRAMES

  const cabrian = Math.ceil(duracionSeg / intervalo)
  const cuantos = Math.max(1, Math.min(tope, cabrian))
  // Si caben todos, se respeta el intervalo; si no, se reparten a lo largo.
  const paso = cuantos >= cabrian ? intervalo : duracionSeg / cuantos

  const out: number[] = []
  for (let i = 0; i < cuantos; i++) {
    const t = round2(i * paso)
    if (t >= duracionSeg) break
    out.push(t)
  }
  return out
}
