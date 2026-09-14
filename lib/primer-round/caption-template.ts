/**
 * Locked @primerroundoficial AI caption + overlay style (Eric YES 2026-09-13).
 *
 * Bottom IG caption (Metricool `text`):
 *   1) Hook question or topic line
 *   2) blank line
 *   3) "[Guest] hoy en Primer Round junto a Dennise Pérez y Rafael Lenín."
 *   4) optional: "Episodio completo en nuestro canal de YouTube: Magic Tv"
 *   5) blank line
 *   6) #magic973 #puertorico #primerround
 *
 * Hosts as **names** in the caption — never @handles.
 * Collabs (`denniseyperez`, `rafaellenin`) stay Metricool-only.
 *
 * Overlay (white lower-third burn-in): 3–4 short lines;
 * line 1 = role+name; rest = question/quote. No hashtags in overlay.
 */

import type { OrthoIssue } from './orthography'

/** Hosts as they appear in the caption line (names, not @handles). */
export const PRIMER_ROUND_CAPTION_HOSTS = 'Dennise Pérez y Rafael Lenín'

export const PRIMER_ROUND_ATTRIBUTION_PHRASE =
  `hoy en Primer Round junto a ${PRIMER_ROUND_CAPTION_HOSTS}.`

export const PRIMER_ROUND_YOUTUBE_LINE =
  'Episodio completo en nuestro canal de YouTube: Magic Tv'

export const PRIMER_ROUND_HASHTAGS = '#magic973 #puertorico #primerround'

/** Handles that must NOT appear with @ in the bottom caption. */
export const PRIMER_ROUND_CAPTION_FORBIDDEN_HANDLES = [
  'denniseyperez',
  'rafaellenin',
  'primerroundoficial',
] as const

/** Soft max chars per overlay line (white lower-third readability). */
export const PRIMER_ROUND_OVERLAY_MAX_LINE_CHARS = 42

export const PRIMER_ROUND_OVERLAY_MIN_LINES = 3
export const PRIMER_ROUND_OVERLAY_MAX_LINES = 4

/** Human-readable skeleton shown in the studio UI. */
export const PRIMER_ROUND_CAPTION_TEMPLATE_SKELETON = [
  '¿Hook o pregunta del tema?',
  '',
  `[Invitado/a] ${PRIMER_ROUND_ATTRIBUTION_PHRASE}`,
  PRIMER_ROUND_YOUTUBE_LINE + '  ← opcional',
  '',
  PRIMER_ROUND_HASHTAGS,
].join('\n')

export function buildPrimerRoundCaption(opts: {
  hook: string
  guest: string
  includeYoutube?: boolean
}): string {
  const hook = opts.hook.trim()
  const guest = opts.guest.trim()
  const lines = [
    hook,
    '',
    `${guest} ${PRIMER_ROUND_ATTRIBUTION_PHRASE}`.replace(/\s+/g, ' ').trim(),
  ]
  if (opts.includeYoutube) {
    lines.push(PRIMER_ROUND_YOUTUBE_LINE)
  }
  lines.push('', PRIMER_ROUND_HASHTAGS)
  return lines.join('\n')
}

/**
 * Locked prompt block injected when generating captions for Primer Round.
 * Replaces the generic "un caption cualquiera" task with the Exact IG format.
 */
export function buildPrimerRoundCaptionPromptInstructions(ctx: {
  title: string
  hook?: string | null
  guestHint?: string | null
  burnedOverlay?: string | null
  videoTranscript?: string | null
  visualSummary?: string | null
  feedback?: string | null
  previousCaption?: string | null
}): string {
  const hintGuest =
    (ctx.guestHint ?? '').trim() ||
    firstOverlayLine(ctx.burnedOverlay) ||
    '(deduce el nombre + rol del invitado del título, overlay, lo que se ve o el audio)'

  return `Eres el copywriter de @primerroundoficial (Magic 97.3 / Primer Round).
Eric BLOQUEÓ este formato: no inventes otro estilo. Devuelve SOLO el caption final.

FORMATO OBLIGATORIO (Metricool text — caption debajo del Reel):
1) Una sola línea: pregunta gancho o tema (puede empezar con ¿…?).
2) Línea en blanco.
3) Exactamente: "[Invitado con rol si aplica] hoy en Primer Round junto a Dennise Pérez y Rafael Lenín."
   - Hosts SIEMPRE como nombres: Dennise Pérez y Rafael Lenín.
   - NUNCA pongas @denniseyperez, @rafaellenin ni @primerroundoficial en el caption.
   - Las collabs de Instagram van SOLO en Metricool (fuera de este texto).
4) Opcional: "Episodio completo en nuestro canal de YouTube: Magic Tv"
5) Línea en blanco.
6) Exactamente estos hashtags (y solo estos): ${PRIMER_ROUND_HASHTAGS}

EJEMPLO DE ORO:
¿Qué impacto tendrá el caso de Elvia Cabrera en el caso de Anthonieska?

Exfiscal Zulma Fúster hoy en Primer Round junto a Dennise Pérez y Rafael Lenín.

${PRIMER_ROUND_HASHTAGS}

CONTEXTO DEL VIDEO:
- Título: ${ctx.title}
- Hook / tema: ${(ctx.hook ?? '').trim() || '(usar overlay / lo que se ve / audio — no el nombre del archivo)'}
- Invitado sugerido (línea 3): ${hintGuest}
${(ctx.visualSummary ?? '').trim() ? `- Qué se ve:\n${ctx.visualSummary!.trim()}` : ''}
${(ctx.burnedOverlay ?? '').trim() ? `- Overlay / textos en pantalla:\n${ctx.burnedOverlay!.trim()}` : ''}
${(ctx.videoTranscript ?? '').trim() ? `- Audio (apoyo):\n${ctx.videoTranscript!.trim().slice(0, 1200)}` : ''}
${(ctx.feedback ?? '').trim()
  ? `
FEEDBACK DE ERIC (aplica estos cambios; mantén el FORMATO OBLIGATORIO):
${ctx.feedback!.trim()}
${(ctx.previousCaption ?? '').trim() ? `CAPTION ANTERIOR (mejóralo, no lo copies tal cual):\n${ctx.previousCaption!.trim()}` : ''}`
  : ''}

REGLAS:
- Español puertorriqueño correcto (tildes, ¿?).
- No emojis salvo que el hook ya los traiga.
- El hook y el invitado salen del overlay, de lo que se VE y del audio. No uses solo el nombre del archivo.
- No inventes datos que no consten en el contexto.
- Si hay FEEDBACK DE ERIC, aplícalo sin romper la plantilla.
- Devuelve SOLO el caption, sin comillas ni explicación.`
}

function firstOverlayLine(overlay?: string | null): string {
  const line = (overlay ?? '')
    .split(/\n/)
    .map((l) => l.trim())
    .find((l) => l.length > 0)
  return line ?? ''
}

/** Structural checks for the bottom IG caption (deterministic, no LLM). */
export function checkPrimerRoundCaptionStructure(caption: string): OrthoIssue[] {
  const text = caption.trim()
  const issues: OrthoIssue[] = []
  if (!text) return issues

  const lower = text.toLowerCase()
  if (!lower.includes('hoy en primer round junto a')) {
    issues.push({
      quote: text.slice(0, 80),
      problem: 'falta la línea de atribución de Primer Round',
      suggestion: `… ${PRIMER_ROUND_ATTRIBUTION_PHRASE}`,
      surface: 'caption',
    })
  } else {
    if (!text.includes('Dennise Pérez') || !text.includes('Rafael Lenín')) {
      issues.push({
        quote: 'hosts',
        problem: 'los hosts deben ir como nombres (Dennise Pérez y Rafael Lenín), no handles',
        suggestion: PRIMER_ROUND_CAPTION_HOSTS,
        surface: 'caption',
      })
    }
  }

  for (const handle of PRIMER_ROUND_CAPTION_FORBIDDEN_HANDLES) {
    const re = new RegExp(`@${handle}\\b`, 'i')
    if (re.test(text)) {
      issues.push({
        quote: `@${handle}`,
        problem: 'no pongas @handles en el caption (collabs solo en Metricool)',
        suggestion: 'usa nombres en la línea de atribución',
        surface: 'caption',
      })
    }
  }

  const hashtagLine = PRIMER_ROUND_HASHTAGS.toLowerCase()
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean)
  const last = (lines[lines.length - 1] ?? '').toLowerCase()
  if (last !== hashtagLine) {
    // Allow trailing whitespace-only differences already trimmed; also accept if hashtags appear as final content with extra spaces between tags
    const normalizedLast = last.replace(/\s+/g, ' ')
    if (normalizedLast !== hashtagLine) {
      issues.push({
        quote: lines[lines.length - 1] ?? '(sin hashtags)',
        problem: 'debe terminar con los hashtags fijados',
        suggestion: PRIMER_ROUND_HASHTAGS,
        surface: 'caption',
      })
    }
  }

  // Extra hashtags beyond the locked set
  const tags = text.match(/#[\p{L}\p{N}_]+/gu) ?? []
  const allowed = new Set(PRIMER_ROUND_HASHTAGS.split(/\s+/).map((t) => t.toLowerCase()))
  for (const tag of tags) {
    if (!allowed.has(tag.toLowerCase())) {
      issues.push({
        quote: tag,
        problem: 'hashtag fuera de la plantilla bloqueada',
        suggestion: PRIMER_ROUND_HASHTAGS,
        surface: 'caption',
      })
    }
  }

  return issues
}

/**
 * Overlay / burn-in expectations: white lower-third, 3–4 short lines,
 * line 1 = role+name, rest = question/quote. Flag length, accents, hashtags.
 */
export function checkPrimerRoundOverlayStructure(overlay: string): OrthoIssue[] {
  const text = overlay.trim()
  const issues: OrthoIssue[] = []
  if (!text) return issues

  const lines = text
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  if (lines.length < PRIMER_ROUND_OVERLAY_MIN_LINES || lines.length > PRIMER_ROUND_OVERLAY_MAX_LINES) {
    issues.push({
      quote: `${lines.length} línea(s)`,
      problem: `overlay lower-third debe tener ${PRIMER_ROUND_OVERLAY_MIN_LINES}–${PRIMER_ROUND_OVERLAY_MAX_LINES} líneas cortas`,
      suggestion: 'línea 1: rol+nombre; resto: pregunta o cita',
      surface: 'overlay',
    })
  }

  for (const line of lines) {
    if (line.length > PRIMER_ROUND_OVERLAY_MAX_LINE_CHARS) {
      issues.push({
        quote: line,
        problem: `línea demasiado larga (>${PRIMER_ROUND_OVERLAY_MAX_LINE_CHARS} caracteres) para lower-third`,
        suggestion: 'partir en más líneas cortas',
        surface: 'overlay',
      })
    }
    if (/#/.test(line) || /@\w/.test(line)) {
      issues.push({
        quote: line,
        problem: 'no usar hashtags ni @handles en el overlay',
        suggestion: 'solo rol, nombre, pregunta o cita',
        surface: 'overlay',
      })
    }
  }

  // Accents / Spanish punctuation heuristics
  const joined = lines.join(' ')
  if (/\?/.test(joined) && !/¿/.test(joined)) {
    issues.push({
      quote: joined.slice(0, 60),
      problem: 'falta signo de apertura ¿ en la pregunta del overlay',
      suggestion: 'usar ¿…?',
      surface: 'overlay',
    })
  }
  if (/!/.test(joined) && !/¡/.test(joined)) {
    issues.push({
      quote: joined.slice(0, 60),
      problem: 'falta signo de apertura ¡',
      suggestion: 'usar ¡…!',
      surface: 'overlay',
    })
  }

  // Common missing-accent tokens seen in PR burn-ins (conservative list)
  const missingAccentHints: Array<{ bad: RegExp; suggestion: string }> = [
    { bad: /\bque\b(?=\s+(impacto|pasa|opina|piensa|significa))/i, suggestion: 'qué' },
    { bad: /\bfuster\b/i, suggestion: 'Fúster' },
    { bad: /\bdiscusión\b/i, suggestion: '' }, // already accented — skip via empty
    { bad: /\bdiscusion\b/i, suggestion: 'discusión' },
    { bad: /\bbiologica\b/i, suggestion: 'biológica' },
    { bad: /\btendra\b/i, suggestion: 'tendrá' },
    { bad: /\blenín\b/i, suggestion: '' },
    { bad: /\brafael lenin\b/i, suggestion: 'Rafael Lenín' },
  ]
  for (const hint of missingAccentHints) {
    if (!hint.suggestion) continue
    const m = joined.match(hint.bad)
    if (m) {
      issues.push({
        quote: m[0],
        problem: 'posible tilde / acentuación faltante en overlay',
        suggestion: hint.suggestion,
        surface: 'overlay',
      })
    }
  }

  return issues
}

/** Merge LLM/analysis issues with deterministic template checks (dedupe by quote+problem). */
export function mergeOrthoIssues(...groups: OrthoIssue[][]): OrthoIssue[] {
  const out: OrthoIssue[] = []
  const seen = new Set<string>()
  for (const group of groups) {
    for (const issue of group) {
      const key = `${issue.surface}|${issue.quote}|${issue.problem}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push(issue)
    }
  }
  return out
}
