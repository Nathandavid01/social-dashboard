/**
 * Heurística honesta para nombrar/comparar el "ángulo" de un caption ya
 * existente — NO es clasificación inteligente, es una regla simple (primera
 * línea + tipo de CTA + hashtags) para que el generador de captions de un
 * mismo lote no repita obviamente el gancho, el CTA o los hashtags de un
 * hermano. Ver lib/utils/idea-caption-prompt.ts (bloque "OTROS CAPTIONS DE
 * ESTE MISMO LOTE") y lib/actions/idea-captions.ts (red de seguridad de
 * una sola regeneración cuando dos captions del lote chocan).
 */

export interface AnguloCaption {
  /** Primera línea no vacía del caption, en minúsculas y sin espacios extra. */
  primeraLinea: string
  /** Tipo de llamado a la acción detectado por palabra clave. */
  tipoCta: TipoCta
}

export type TipoCta = 'comprar' | 'reservar' | 'comentar' | 'guardar' | 'compartir' | 'mensaje' | 'link' | 'otro'

const CTA_KEYWORDS: { tipo: TipoCta; palabras: string[] }[] = [
  { tipo: 'comprar', palabras: ['compra', 'compran', 'ordena', 'pide el tuyo', 'adquiere'] },
  { tipo: 'reservar', palabras: ['reserva', 'agenda tu cita', 'agenda', 'separa tu cupo'] },
  { tipo: 'comentar', palabras: ['comenta', 'cuéntanos', 'cuentanos', 'dinos'] },
  { tipo: 'guardar', palabras: ['guarda este', 'guárdalo', 'guardalo'] },
  { tipo: 'compartir', palabras: ['comparte', 'etiqueta a', 'menciona a'] },
  { tipo: 'mensaje', palabras: ['escríbenos', 'escribenos', 'envíanos', 'enviamos', 'por dm', 'mándanos'] },
  { tipo: 'link', palabras: ['link en bio', 'link en la bio', 'enlace en bio'] },
]

const normalizeLine = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, ' ')

function detectCtaType(text: string): TipoCta {
  const lower = text.toLowerCase()
  for (const { tipo, palabras } of CTA_KEYWORDS) {
    if (palabras.some((p) => lower.includes(p))) return tipo
  }
  return 'otro'
}

/**
 * Extrae la "primera línea" (el gancho tal como quedó escrito) y el tipo de
 * CTA de un caption. No entiende el contenido — solo mira texto literal, es
 * a propósito para no venderlo como más listo de lo que es.
 */
export function nombrarAngulo(caption: string): AnguloCaption {
  const lines = (caption ?? '').split('\n').map((l) => l.trim()).filter(Boolean)
  const primeraLinea = lines.length > 0 ? normalizeLine(lines[0]) : ''
  const tipoCta = detectCtaType(caption ?? '')
  return { primeraLinea, tipoCta }
}

function extractHashtags(text: string): Set<string> {
  const matches = (text ?? '').match(/#[\wáéíóúñü]+/gi) ?? []
  return new Set(matches.map((h) => h.toLowerCase()))
}

/** Fracción de la lista más pequeña que también aparece en la otra (0..1). */
function overlapRatio(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  const [small, big] = a.size <= b.size ? [a, b] : [b, a]
  let shared = 0
  for (const h of small) if (big.has(h)) shared++
  return shared / small.size
}

/**
 * Red de seguridad, NO un juicio de calidad: detecta repetición OBVIA entre
 * dos captions del mismo lote — misma primera línea, o mismo tipo de CTA con
 * hashtags muy solapados. No detecta parecidos sutiles de fondo/tono a
 * propósito (eso lo cubre el prompt, no este chequeo).
 */
export function sonDemasiadoParecidos(a: string, b: string): boolean {
  const angA = nombrarAngulo(a)
  const angB = nombrarAngulo(b)
  if (!angA.primeraLinea || !angB.primeraLinea) {
    // Sin texto suficiente para comparar — no hay base para marcar choque.
    if (!angA.primeraLinea && !angB.primeraLinea) return false
  } else if (angA.primeraLinea === angB.primeraLinea) {
    return true
  }

  const tags = overlapRatio(extractHashtags(a), extractHashtags(b))
  if (angA.tipoCta !== 'otro' && angA.tipoCta === angB.tipoCta && tags >= 0.6) return true

  return false
}
