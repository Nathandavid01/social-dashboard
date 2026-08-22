/** Nota de viralidad 1–10 que viene de la IA. Basura no se convierte en un 5. */
export function clampVirality(raw: unknown): number | null {
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw.trim()) : NaN
  if (!Number.isFinite(n)) return null
  const rounded = Math.round(n)
  if (rounded < 1 || rounded > 10) return null
  return rounded
}

export type ViralityBand = 'alto' | 'medio' | 'bajo'

export function viralityBand(score: number): ViralityBand {
  if (score >= 8) return 'alto'
  if (score >= 5) return 'medio'
  return 'bajo'
}
