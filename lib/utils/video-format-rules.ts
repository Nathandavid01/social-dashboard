/**
 * QC de formato (Eric, 2026-09-02: "errores en las tomas o formatos"). Puro:
 * con el ancho/alto/duración que el navegador ya lee al extraer fotogramas
 * (video-frames-dom) y las redes del cliente, dice si el corte sirve para
 * donde va a publicarse. Sin tokens de IA: son reglas.
 */
export interface VideoFormatMeta {
  width: number
  height: number
  durationSec: number
}

export interface VideoFormatFindings {
  width: number
  height: number
  durationSec: number
  /** "9:16", "16:9", "1:1", "4:5" u otro aproximado. */
  aspect: string
  orientation: 'vertical' | 'horizontal' | 'cuadrado'
  issues: { problem: string; suggestion: string }[]
}

/** Redes que piden vertical 9:16 (Reels, TikTok, Stories). */
const VERTICAL_PLATFORMS = new Set(['instagram', 'tiktok', 'facebook'])
const REEL_MAX_SEC = 90
const TIKTOK_MAX_SEC = 600
const MIN_SHORT_SIDE = 1080
const MIN_SHORT_SIDE_HARD = 720
const MIN_DURATION_SEC = 3

const KNOWN_ASPECTS: [string, number][] = [
  ['9:16', 9 / 16],
  ['16:9', 16 / 9],
  ['1:1', 1],
  ['4:5', 4 / 5],
  ['4:3', 4 / 3],
  ['3:4', 3 / 4],
]

export function aspectLabel(width: number, height: number): string {
  if (!width || !height) return '?'
  const r = width / height
  let best: [string, number] = ['?', Infinity]
  for (const [label, value] of KNOWN_ASPECTS) {
    const diff = Math.abs(r - value) / value
    if (diff < best[1]) best = [label, diff]
  }
  return best[1] <= 0.03 ? best[0] : `${width}:${height}`
}

export function isValidFormatMeta(meta: unknown): meta is VideoFormatMeta {
  const m = meta as Partial<VideoFormatMeta> | null
  return !!m
    && typeof m.width === 'number' && Number.isFinite(m.width) && m.width > 0
    && typeof m.height === 'number' && Number.isFinite(m.height) && m.height > 0
    && typeof m.durationSec === 'number' && Number.isFinite(m.durationSec) && m.durationSec >= 0
}

export function formatFindings(
  meta: VideoFormatMeta,
  target: { platforms?: string[] | null },
): VideoFormatFindings {
  const { width, height, durationSec } = meta
  const orientation: VideoFormatFindings['orientation'] =
    width === height ? 'cuadrado' : width > height ? 'horizontal' : 'vertical'
  const issues: VideoFormatFindings['issues'] = []
  const platforms = (target.platforms ?? []).map((p) => p.toLowerCase())
  const wantsVertical = platforms.some((p) => VERTICAL_PLATFORMS.has(p))

  if (wantsVertical && orientation !== 'vertical') {
    issues.push({
      problem: `El video es ${orientation} (${aspectLabel(width, height)}) y va para Reels/TikTok, que piden vertical 9:16.`,
      suggestion: 'Exportar en 1080×1920 (9:16) o reencuadrar antes de entregar.',
    })
  }
  const shortSide = Math.min(width, height)
  if (shortSide < MIN_SHORT_SIDE_HARD) {
    issues.push({
      problem: `Resolución baja: ${width}×${height}. Se verá borroso en el teléfono.`,
      suggestion: 'Exportar a 1080p como mínimo (1080×1920 vertical).',
    })
  } else if (shortSide < MIN_SHORT_SIDE) {
    issues.push({
      problem: `Resolución por debajo de 1080p: ${width}×${height}.`,
      suggestion: 'Exportar a 1080×1920 para que no pierda nitidez al subirlo.',
    })
  }
  if (durationSec > 0 && durationSec < MIN_DURATION_SEC) {
    issues.push({ problem: `Dura ${durationSec.toFixed(1)} s: demasiado corto para un post.`, suggestion: 'Revisar que el archivo esté completo.' })
  }
  if (platforms.includes('instagram') && durationSec > REEL_MAX_SEC) {
    issues.push({
      problem: `Dura ${Math.round(durationSec)} s; un Reel de Instagram debe quedar en ${REEL_MAX_SEC} s o menos.`,
      suggestion: 'Recortar el corte o entregar una versión corta para Instagram.',
    })
  } else if (platforms.includes('tiktok') && durationSec > TIKTOK_MAX_SEC) {
    issues.push({
      problem: `Dura ${Math.round(durationSec)} s; TikTok corta a los ${TIKTOK_MAX_SEC / 60} minutos.`,
      suggestion: 'Recortar el corte.',
    })
  }

  return { width, height, durationSec, aspect: aspectLabel(width, height), orientation, issues }
}

/** Texto corto para la fila del QC: "9:16 · 1080×1920 · 18 s". */
export function formatSummaryText(f: VideoFormatFindings): string {
  return `${f.aspect} · ${f.width}×${f.height} · ${Math.round(f.durationSec)} s`
}
