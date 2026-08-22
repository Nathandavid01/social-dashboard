/**
 * Tipos de toma de On Site.
 *
 * El valor guardado es estable y sin acentos (viaja por URLs y comparaciones
 * SQL); la etiqueta es lo que se lee en pantalla. Añadir una cámara es una
 * línea aquí: shot_type es texto, no un enum de Postgres.
 */
export const SHOT_TYPES = [
  { key: 'dji', label: 'DJI' },
  { key: 'dji_pov', label: 'DJI First Person POV' },
  { key: 'sony', label: 'Sony' },
  { key: 'producto', label: 'Fotos de Producto' },
] as const

export type ShotTypeKey = (typeof SHOT_TYPES)[number]['key']

export function shotTypeLabel(key: string | null | undefined): string {
  return SHOT_TYPES.find((t) => t.key === key)?.label ?? 'Sin tipo'
}

export interface OnsiteShot {
  id: string
  title: string
  hook: string | null
  /** Qué grabar, paso a paso. */
  visualBrief: string | null
  /** 1–10 de la IA; null si aún no se puntuó. */
  viralityScore: number | null
  /** Por qué esa nota. */
  viralityWhy: string | null
  referenceUrl: string | null
  shotType: string | null
  /** status === 'grabada' — la misma verdad que el resto de la app. */
  recorded: boolean
}

export interface ShotGroup {
  key: string
  label: string
  shots: OnsiteShot[]
  recorded: number
  pending: number
}

export interface OnsiteProgress {
  total: number
  recorded: number
  pending: number
  /** 0..100, redondeado. 0 cuando no hay tomas — no 100. */
  pct: number
}

/**
 * Agrupa las tomas por tipo, en el orden de SHOT_TYPES. Un grupo vacío no
 * aparece; uno "Sin tipo" sí, al final: una toma sin clasificar no puede
 * desaparecer de la lista de quien está grabando.
 */
export function groupShots(shots: OnsiteShot[]): ShotGroup[] {
  const out: ShotGroup[] = []
  for (const t of SHOT_TYPES) {
    const s = shots.filter((x) => x.shotType === t.key)
    if (s.length === 0) continue
    out.push({
      key: t.key,
      label: t.label,
      shots: s,
      recorded: s.filter((x) => x.recorded).length,
      pending: s.filter((x) => !x.recorded).length,
    })
  }
  const known = new Set<string>(SHOT_TYPES.map((t) => t.key))
  const sinTipo = shots.filter((x) => !x.shotType || !known.has(x.shotType))
  if (sinTipo.length > 0) {
    out.push({
      key: 'sin_tipo',
      label: 'Sin tipo',
      shots: sinTipo,
      recorded: sinTipo.filter((x) => x.recorded).length,
      pending: sinTipo.filter((x) => !x.recorded).length,
    })
  }
  return out
}

export function progressOf(shots: OnsiteShot[]): OnsiteProgress {
  const total = shots.length
  const recorded = shots.filter((s) => s.recorded).length
  return {
    total,
    recorded,
    pending: total - recorded,
    pct: total === 0 ? 0 : Math.round((recorded / total) * 100),
  }
}
