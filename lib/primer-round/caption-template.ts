/**
 * Locked @primerroundoficial AI caption + overlay style (Eric YES 2026-09-13).
 *
 * Bottom IG caption (Metricool `text`):
 *   1) Hook question or topic line
 *   2) blank line
 *   3) Facebook: "Mañana desde las 5:43 AM junto a @rafaellenin y @denniseyperez."
 *      With guest: "[Invitado] mañana desde las 5:43 AM junto a @rafaellenin y @denniseyperez."
 *   4) optional: "Episodio completo en nuestro canal de YouTube: Magic Tv"
 *   5) blank line
 *   6) #magic973 #puertorico #primerround
 *
 * Hosts tagged with @ in the caption. Collabs also go to Metricool IG.
 *
 * Overlay (white lower-third burn-in): 3–4 short lines;
 * line 1 = role+name; rest = question/quote. No hashtags in overlay.
 */

import type { OrthoIssue } from './orthography'
import { formatPrimerRoundStyleRulesBlock } from './style-rules'
import {
  primerRoundAirPhrase,
  primerRoundNextAirCopy,
  type PrimerRoundAirCopy,
} from './air-time'
import type { PrimerRoundPieceKind } from './piece-kind'

export type { PrimerRoundPieceKind }

/** Hosts tagged in the caption (Rafael first, then Dennise). */
export const PRIMER_ROUND_CAPTION_HOSTS = '@rafaellenin y @denniseyperez'

/** LIVE clip line 3 — names, not @handles. GFX uses the air-time + @handles line. */
export const PRIMER_ROUND_LIVE_CLIP_LINE =
  'Hoy en Primer Round junto a Rafael Lenín López y Dennise Pérez.'

/** Old + Facebook live line: "hoy en Primer Round junto a…" or "Mañana desde las 5:43 AM junto a…" */
export const PRIMER_ROUND_LIVE_LINE =
  /(?:hoy|mañana|el lunes)(?: a las 5:43am| desde las 5:43 ?AM)?(?: en Primer Round)? junto a/i

export const PRIMER_ROUND_ATTRIBUTION_PHRASE =
  `hoy en Primer Round junto a ${PRIMER_ROUND_CAPTION_HOSTS}.`

/** Facebook line 3. Sunday → "Mañana desde las 5:43 AM junto a @rafaellenin y @denniseyperez." */
export function primerRoundLiveAttribution(
  air: PrimerRoundAirCopy = primerRoundNextAirCopy(),
  startOfLine = true,
): string {
  const lead = primerRoundAirPhrase(air.when, startOfLine)
  return `${lead} junto a ${PRIMER_ROUND_CAPTION_HOSTS}.`
}

export const PRIMER_ROUND_YOUTUBE_LINE =
  'Episodio completo en nuestro canal de YouTube: Magic Tv'

export const PRIMER_ROUND_HASHTAGS = '#magic973 #puertorico #primerround'

/** Handles that must NOT appear with @ in the bottom caption. */
export const PRIMER_ROUND_CAPTION_FORBIDDEN_HANDLES = [
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
  `[Invitado/a] ${primerRoundLiveAttribution()}`,
  PRIMER_ROUND_YOUTUBE_LINE + '  ← opcional',
  '',
  PRIMER_ROUND_HASHTAGS,
].join('\n')

export function buildPrimerRoundCaption(opts: {
  hook: string
  guest: string
  includeYoutube?: boolean
  airCopy?: PrimerRoundAirCopy | null
}): string {
  const hook = opts.hook.trim()
  const guest = opts.guest.trim()
  const air = opts.airCopy ?? primerRoundNextAirCopy()
  const hasGuest = Boolean(guest && !sameCaptionLead(guest, hook))
  const attribution = primerRoundLiveAttribution(air, !hasGuest)
  const line3 = hasGuest ? `${guest} ${attribution}`.replace(/\s+/g, ' ').trim() : attribution
  const lines = [hook, '', line3]
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
  styleRules?: string[] | null
  airCopy?: PrimerRoundAirCopy | null
  airNowMs?: number
  /** live = clip del programa; gfx = Reel gráfico/promo. Default gfx. */
  kind?: PrimerRoundPieceKind | null
}): string {
  const kind: PrimerRoundPieceKind = ctx.kind === 'live' ? 'live' : 'gfx'
  const overlayFirst = firstOverlayLine(ctx.burnedOverlay)
  const hintGuest =
    (ctx.guestHint ?? '').trim() ||
    (looksLikeGuestName(overlayFirst) ? overlayFirst : '') ||
    (kind === 'live'
      ? '(clip: la línea 3 es SOLO la frase de Hoy en Primer Round + hosts por nombre.)'
      : '(GFX sin invitado: la línea 3 es SOLO el horario + hosts. NO copies el gancho otra vez.)')
  const air = ctx.airCopy ?? primerRoundNextAirCopy(ctx.airNowMs)
  const liveAttribution = primerRoundLiveAttribution(air)
  const line3 =
    kind === 'live' ? PRIMER_ROUND_LIVE_CLIP_LINE : liveAttribution
  const formatBlock =
    kind === 'live'
      ? `FORMATO OBLIGATORIO (clip LIVE del programa — caption debajo del Reel):
1) Una sola línea: gancho de lo que se VE y se OYE (puede empezar con ¿…?).
2) Línea en blanco.
3) Exactamente: "${PRIMER_ROUND_LIVE_CLIP_LINE}"
   - Hosts por NOMBRE COMPLETO, en este orden: Rafael Lenín López y Dennise Pérez.
   - NO uses @handles en esta línea (eso es del Reel gráfico).
   - NO uses "Mañana desde las 5:43 AM" — esa frase es SOLO para GFX/promo.
   - NUNCA pongas @primerroundoficial en el caption.
   - Las collabs de Instagram (@rafaellenin y @denniseyperez) van en Metricool, no hace falta repetirlas aquí.
4) Opcional: "${PRIMER_ROUND_YOUTUBE_LINE}"
5) Línea en blanco.
6) Exactamente estos hashtags (y solo estos): ${PRIMER_ROUND_HASHTAGS}`
      : `FORMATO OBLIGATORIO (Metricool text — caption debajo del Reel):
1) Una sola línea: pregunta gancho o tema (puede empezar con ¿…?).
2) Línea en blanco.
3) Si hay un invitado (persona + rol) distinto del gancho: "[Invitado] ${liveAttribution}"
   Si es GFX/promo sin invitado: SOLO "${liveAttribution}"
   NO empieces la línea 3 con la misma frase de la línea 1.
   - Hosts SIEMPRE tagueados, en este orden: @rafaellenin y @denniseyperez.
   - NUNCA pongas @primerroundoficial en el caption.
   - Las collabs de Instagram también van en Metricool.
   - Horario al aire: lunes a viernes 5:43 AM (Puerto Rico). Frase de Facebook: "${liveAttribution}"
4) En Reels gráficos / promo (GFX, no clip del programa): NO pongas la línea de YouTube.
5) Línea en blanco.
6) Exactamente estos hashtags (y solo estos): ${PRIMER_ROUND_HASHTAGS}`

  const goldExample =
    kind === 'live'
      ? `EJEMPLO DE ORO (clip LIVE del programa):
¿Qué pasó esta mañana en el estudio?

${PRIMER_ROUND_LIVE_CLIP_LINE}

${PRIMER_ROUND_HASHTAGS}`
      : `EJEMPLO DE ORO (Reel gráfico, no clip — el gancho NO se repite):
LA NOTICIA NO ESPERA

${liveAttribution}

${PRIMER_ROUND_HASHTAGS}`

  return `Eres el copywriter de @primerroundoficial (Magic 97.3 / Primer Round).
Eric BLOQUEÓ este formato: no inventes otro estilo. Devuelve SOLO el caption final.

${formatBlock}

${goldExample}

${formatPrimerRoundStyleRulesBlock(ctx.styleRules ?? [])}

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
- NUNCA inventes diálogo ni palabras dichas. Si no está en la transcripción, no lo pongas entre comillas ni como si alguien lo hubiera dicho.
- El hook sale de la FRASE PRINCIPAL del overlay o de lo que se oye, no del nombre del archivo.
- NO repitas el gancho en la línea 3.
- Este tipo de video es ${kind === 'live' ? 'un CLIP LIVE del programa (no GFX). La línea 3 DEBE ser: ' + PRIMER_ROUND_LIVE_CLIP_LINE : 'GFX/promo, no un clip del programa. La línea 3 DEBE ser la frase de Facebook: ' + line3 + ' (domingo publicado hoy → Mañana desde las 5:43 AM).'}
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

function foldCaptionLead(text: string): string {
  return text
    .toLowerCase()
    .replace(/[¿?¡!.,;:]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function sameCaptionLead(a: string, b: string): boolean {
  const left = foldCaptionLead(a)
  const right = foldCaptionLead(b)
  return !!left && left === right
}

/** All-caps slogans are hooks, not guest names. "Exfiscal Zulma Fúster" is a guest. */
function looksLikeGuestName(line: string): boolean {
  const text = line.trim()
  if (!text || /^(¿|¡)/.test(text)) return false
  if (text === text.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(text)) return false
  return /[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+/.test(text)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Drop "LA NOTICIA NO ESPERA …" when line 3 repeats the hook. */
export function stripRepeatedPrimerRoundHook(caption: string): string {
  const lines = caption.split('\n')
  const hook = lines.find((line) => line.trim())?.trim() ?? ''
  if (!hook) return caption
  const hookBare = hook.replace(/[¿?¡!.,;:]+$/g, '').trim()
  const attrIdx = lines.findIndex((line) => PRIMER_ROUND_LIVE_LINE.test(line))
  if (attrIdx < 0) return caption
  const line = lines[attrIdx].trim()
  const repeated = new RegExp(`^${escapeRegExp(hookBare)}\\s+`, 'i')
  if (repeated.test(line)) lines[attrIdx] = line.replace(repeated, '')
  return lines.join('\n')
}

const ATTRIBUTION_LINE =
  /^(.*?)((?:hoy|mañana|el lunes)(?: a las 5:43am| desde las 5:43 ?AM)?(?: en Primer Round)? junto a .+)$/i

/** Facebook live line (hosts + desde las 5:43 AM), then no repeated hook. */
export function rewritePrimerRoundLiveLine(
  caption: string,
  air: PrimerRoundAirCopy = primerRoundNextAirCopy(),
): string {
  return caption
    .split('\n')
    .map((raw) => {
      const match = raw.match(ATTRIBUTION_LINE)
      if (!match) return raw
      const prefix = match[1].trim()
      const guest = looksLikeGuestName(prefix) ? prefix : ''
      const live = primerRoundLiveAttribution(air, !guest)
      return guest ? `${guest} ${live}` : live
    })
    .join('\n')
}

/** Clip LIVE: force the names line, never the GFX air-time + @handles line. */
export function rewritePrimerRoundLiveClipLine(caption: string): string {
  return caption
    .split('\n')
    .map((raw) => {
      const match = raw.match(ATTRIBUTION_LINE)
      if (!match) return raw
      const prefix = match[1].trim()
      const guest = looksLikeGuestName(prefix) ? prefix : ''
      return guest ? `${guest} ${PRIMER_ROUND_LIVE_CLIP_LINE}` : PRIMER_ROUND_LIVE_CLIP_LINE
    })
    .join('\n')
}

export function normalizePrimerRoundCaption(
  caption: string,
  air?: PrimerRoundAirCopy,
  kind: PrimerRoundPieceKind = 'gfx',
): string {
  const stripped = stripRepeatedPrimerRoundHook(caption)
  if (kind === 'live') return rewritePrimerRoundLiveClipLine(stripped)
  return rewritePrimerRoundLiveLine(stripped, air ?? primerRoundNextAirCopy())
}

/** Structural checks for the bottom IG caption (deterministic, no LLM). */
export function checkPrimerRoundCaptionStructure(
  caption: string,
  kind: PrimerRoundPieceKind = 'gfx',
): OrthoIssue[] {
  const text = caption.trim()
  const issues: OrthoIssue[] = []
  if (!text) return issues

  const lower = text.toLowerCase()
  if (kind === 'live') {
    const hasLiveLine = /hoy en primer round junto a rafael lenín lópez y dennise pérez/.test(lower)
    if (!hasLiveLine) {
      issues.push({
        quote: text.slice(0, 80),
        problem: 'falta la línea de clip LIVE de Primer Round',
        suggestion: PRIMER_ROUND_LIVE_CLIP_LINE,
        surface: 'caption',
      })
    }
    if (/mañana desde las 5:43 ?am/i.test(text)) {
      issues.push({
        quote: 'Mañana desde las 5:43 AM',
        problem: 'el horario de aire es para GFX/promo, no para un clip LIVE',
        suggestion: PRIMER_ROUND_LIVE_CLIP_LINE,
        surface: 'caption',
      })
    }
  } else {
    const hasAttribution =
      /(?:hoy|mañana|el lunes) desde las 5:43 ?am junto a @rafaellenin y @denniseyperez/.test(lower)
    if (!hasAttribution) {
      issues.push({
        quote: text.slice(0, 80),
        problem: 'falta la línea de atribución de Primer Round (con el horario de aire)',
        suggestion: `… ${primerRoundLiveAttribution()}`,
        surface: 'caption',
      })
    } else {
    const hook = text.split(/\n/).map((line) => line.trim()).find(Boolean) ?? ''
    const attrLine =
      text
        .split(/\n/)
        .map((line) => line.trim())
        .find((line) => PRIMER_ROUND_LIVE_LINE.test(line)) ?? ''
    const hookBare = hook.replace(/[¿?¡!.,;:]+$/g, '').trim()
    if (hookBare && new RegExp(`^${escapeRegExp(hookBare)}\\s+`, 'i').test(attrLine)) {
      issues.push({
        quote: attrLine.slice(0, 80),
        problem: 'no repitas el gancho en la línea siguiente',
        suggestion: primerRoundLiveAttribution(),
        surface: 'caption',
      })
    }
    if (!/@rafaellenin\b/i.test(text) || !/@denniseyperez\b/i.test(text)) {
      issues.push({
        quote: 'hosts',
        problem: 'taguea a @rafaellenin y @denniseyperez',
        suggestion: PRIMER_ROUND_CAPTION_HOSTS,
        surface: 'caption',
      })
    }
  }
  }

  for (const handle of PRIMER_ROUND_CAPTION_FORBIDDEN_HANDLES) {
    const re = new RegExp(`@${handle}\\b`, 'i')
    if (re.test(text)) {
      issues.push({
        quote: `@${handle}`,
        problem: 'no pongas @primerroundoficial en el caption',
        suggestion: 'taguea a @rafaellenin y @denniseyperez',
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
