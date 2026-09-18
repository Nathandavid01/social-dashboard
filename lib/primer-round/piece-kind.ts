/**
 * Primer Round pieces are either a LIVE clip of the show or a GFX/promo Reel.
 * Caption templates differ; Metricool collabs apply to both.
 */

export type PrimerRoundPieceKind = 'live' | 'gfx'

export type PieceKindHint = {
  visualSummary?: string | null
  burnedOverlay?: string | null
  transcript?: string | null
  fileName?: string | null
}

function blob(input: PieceKindHint): string {
  return [input.fileName, input.burnedOverlay, input.visualSummary, input.transcript]
    .map((s) => (s ?? '').trim())
    .filter(Boolean)
    .join('\n')
    .toLowerCase()
}

/**
 * Conservative detector. Unclear → gfx (the locked promo template).
 * Filename and overlay slogans beat a short transcript.
 */
export function detectPrimerRoundPieceKind(input: PieceKindHint): PrimerRoundPieceKind {
  const name = (input.fileName ?? '').toLowerCase()
  if (/\bgfx\b|promo|lower[- ]?third|gr[aá]fico/.test(name)) return 'gfx'
  if (/\b(clip|live|aire|entrevista)\b/.test(name)) return 'live'

  const overlay = (input.burnedOverlay ?? '').trim()
  const transcript = (input.transcript ?? '').trim()
  const visual = (input.visualSummary ?? '').toLowerCase()
  const all = blob(input)

  if (/la noticia no espera/.test(all)) return 'gfx'
  const overlayLines = overlay.split(/\n/).map((l) => l.trim()).filter(Boolean)
  const slogan =
    overlayLines.length > 0 &&
    overlayLines.every((l) => l === l.toUpperCase()) &&
    overlay.length < 120
  if (slogan && transcript.length < 40) return 'gfx'
  if (/gr[aá]fico|lower[- ]third|logo anim|promo/.test(visual) && transcript.length < 80) {
    return 'gfx'
  }

  if (transcript.length >= 80) return 'live'
  if (/estudio|en el aire|junto a rafael|junto a dennise|clip del programa/.test(visual)) {
    return 'live'
  }
  return 'gfx'
}

export function resolvePrimerRoundPieceKind(
  requested: 'auto' | PrimerRoundPieceKind | null | undefined,
  hints: PieceKindHint,
): PrimerRoundPieceKind {
  if (requested === 'live' || requested === 'gfx') return requested
  return detectPrimerRoundPieceKind(hints)
}
