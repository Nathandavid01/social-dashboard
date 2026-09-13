/**
 * Primer Round publish gates:
 *   CREATE  = bottom IG Reel caption (Metricool `text`) — generated elsewhere
 *   VERIFY  = (1) overlay / burn-in on-screen text  AND  (2) that bottom caption
 *
 * Auto Metricool upload is blocked until both verifications pass (or Eric overrides).
 */

export interface OrthoIssue {
  quote: string
  problem: string
  suggestion: string
  t?: string
  /** Where the issue was found. */
  surface: 'overlay' | 'caption'
}

export interface SurfaceOrtho {
  ok: boolean
  text: string
  issues: OrthoIssue[]
  missing: boolean
  source: 'video_analysis' | 'llm' | 'empty' | 'caption_field'
}

export interface PrimerRoundOrthoGate {
  overlay: SurfaceOrtho
  caption: SurfaceOrtho
  /** Both surfaces ok (missing overlay fails unless overridden). */
  ok: boolean
}

export function overlayFromBurnedCaptions(input: {
  text?: string | null
  issues?: Array<{ quote?: string; problem?: string; suggestion?: string; t?: string }> | null
}): SurfaceOrtho {
  const text = (input.text ?? '').trim()
  const issues: OrthoIssue[] = (input.issues ?? [])
    .filter((i) => (i.quote ?? '').trim().length > 0)
    .map((i) => ({
      quote: (i.quote ?? '').trim(),
      problem: (i.problem ?? 'ortografía').trim() || 'ortografía',
      suggestion: (i.suggestion ?? '').trim(),
      t: i.t,
      surface: 'overlay' as const,
    }))
  if (!text && issues.length === 0) {
    return { ok: false, text: '', issues: [], missing: true, source: 'empty' }
  }
  return {
    ok: issues.length === 0,
    text,
    issues,
    missing: false,
    source: 'video_analysis',
  }
}

export function captionSurfaceFromText(
  caption: string | null | undefined,
  issues: OrthoIssue[] = [],
): SurfaceOrtho {
  const text = (caption ?? '').trim()
  if (!text) {
    return { ok: false, text: '', issues: [], missing: true, source: 'empty' }
  }
  const scoped = issues.map((i) => ({ ...i, surface: 'caption' as const }))
  return {
    ok: scoped.length === 0,
    text,
    issues: scoped,
    missing: false,
    source: 'caption_field',
  }
}

export function buildPrimerRoundOrthoGate(opts: {
  overlay: SurfaceOrtho
  caption: SurfaceOrtho
}): PrimerRoundOrthoGate {
  const ok = opts.overlay.ok && !opts.overlay.missing && opts.caption.ok && !opts.caption.missing
  return { overlay: opts.overlay, caption: opts.caption, ok }
}

/** Whether auto-upload may proceed. */
export function canAutoSchedulePrimerRound(opts: {
  gate: PrimerRoundOrthoGate
  overrideOrtho: boolean
  autopostEnabled: boolean
  collabsReady: boolean
}): { allowed: boolean; reason?: string } {
  if (!opts.autopostEnabled) {
    return { allowed: false, reason: 'Auto-agenda desactivada (PRIMER_ROUND_AUTOPOST=false)' }
  }
  if (!opts.collabsReady) {
    return { allowed: false, reason: 'Faltan handles de colaboración de Instagram' }
  }
  if (opts.gate.ok || opts.overrideOrtho) return { allowed: true }

  const parts: string[] = []
  if (opts.gate.overlay.missing) parts.push('sin texto overlay')
  else if (!opts.gate.overlay.ok) parts.push(`overlay: ${opts.gate.overlay.issues.length} problema(s)`)
  if (opts.gate.caption.missing) parts.push('falta caption de IG')
  else if (!opts.gate.caption.ok) parts.push(`caption: ${opts.gate.caption.issues.length} problema(s)`)
  return { allowed: false, reason: `Verificación pendiente (${parts.join('; ')})` }
}

/** LLM prompt: verify overlay AND bottom caption. Does not create overlay text. */
export function buildDualOrthoPrompt(overlayText: string, captionText: string): string {
  return `Eres el corrector ortográfico de Nate Media PR para Primer Round (Magic 97.3 / @primerroundoficial).
Verifica ortografía, tildes, puntuación y que el texto en pantalla sea correcto.
El español puertorriqueño, anglicismos y slang deliberado NO son errores.
NO inventes palabras. NO reescribas el estilo. NO generes texto overlay nuevo.

TEXTO OVERLAY / BURN-IN (en pantalla — verificar que sea correcto):
"""
${overlayText.trim() || '(vacío)'}
"""

CAPTION DE IG DEBAJO DEL REEL (Metricool text — verificar):
"""
${captionText.trim() || '(vacío)'}
"""

Devuelve SOLO JSON:
{
  "overlay_ok": true|false,
  "caption_ok": true|false,
  "issues": [{"surface":"overlay"|"caption","quote":"...","problem":"...","suggestion":"..."}]
}`
}

export function parseDualOrthoLlm(raw: string, overlayText: string, captionText: string): PrimerRoundOrthoGate {
  const trimmed = raw.trim()
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  const emptyOverlay = overlayFromBurnedCaptions({ text: overlayText, issues: [] })
  const emptyCaption = captionSurfaceFromText(captionText)
  if (start < 0 || end <= start) {
    return buildPrimerRoundOrthoGate({
      overlay: { ...emptyOverlay, ok: false, source: 'llm' },
      caption: { ...emptyCaption, ok: false, source: 'llm' },
    })
  }
  try {
    const parsed = JSON.parse(trimmed.slice(start, end + 1)) as {
      overlay_ok?: boolean
      caption_ok?: boolean
      issues?: Array<{ surface?: string; quote?: string; problem?: string; suggestion?: string }>
    }
    const allIssues: OrthoIssue[] = (parsed.issues ?? [])
      .filter((i) => (i.quote ?? '').trim())
      .map((i) => ({
        quote: (i.quote ?? '').trim(),
        problem: (i.problem ?? 'ortografía').trim() || 'ortografía',
        suggestion: (i.suggestion ?? '').trim(),
        surface: i.surface === 'caption' ? 'caption' : 'overlay',
      }))
    const overlayIssues = allIssues.filter((i) => i.surface === 'overlay')
    const captionIssues = allIssues.filter((i) => i.surface === 'caption')
    const overlay: SurfaceOrtho = {
      text: (overlayText ?? '').trim(),
      issues: overlayIssues,
      missing: !(overlayText ?? '').trim(),
      ok: parsed.overlay_ok === true && overlayIssues.length === 0 && !!(overlayText ?? '').trim(),
      source: 'llm',
    }
    const caption: SurfaceOrtho = {
      text: (captionText ?? '').trim(),
      issues: captionIssues,
      missing: !(captionText ?? '').trim(),
      ok: parsed.caption_ok === true && captionIssues.length === 0 && !!(captionText ?? '').trim(),
      source: 'llm',
    }
    return buildPrimerRoundOrthoGate({ overlay, caption })
  } catch {
    return buildPrimerRoundOrthoGate({
      overlay: { ...emptyOverlay, ok: false, source: 'llm' },
      caption: { ...emptyCaption, ok: false, source: 'llm' },
    })
  }
}
