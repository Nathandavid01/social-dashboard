/**
 * Pure helpers for the report's "action plan" — concrete, data-backed
 * recommendations for the client. All derived from real Metricool numbers (no
 * AI guessing), so the advice is trustworthy.
 */

const DAYS = ['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']

/** Metricool /stats/besttimes/{net} → {dayIso:{hour:score}}. Returns the peak
 * slot as a Spanish label like "jueves a las 18:00", or null. */
export function parseBestTime(map: unknown): string | null {
  if (!map || typeof map !== 'object') return null
  let best: { day: number; hour: number; score: number } | null = null
  for (const [d, hours] of Object.entries(map as Record<string, unknown>)) {
    if (!hours || typeof hours !== 'object') continue
    for (const [h, score] of Object.entries(hours as Record<string, unknown>)) {
      const s = typeof score === 'number' ? score : 0
      const day = Number(d)
      const hour = Number(h)
      if (s > 0 && day >= 1 && day <= 7 && hour >= 0 && hour <= 23 && (!best || s > best.score)) {
        best = { day, hour, score: s }
      }
    }
  }
  if (!best) return null
  return `${DAYS[best.day]} a las ${String(best.hour).padStart(2, '0')}:00`
}

export interface PlanFacts {
  winningFormat: string | null
  bestTime: string | null
  clicks: number
  saves: number
  reachDeltaPct: number | null
  posts: number
  periodDays: number
}

export type PlanTone = 'up' | 'time' | 'save' | 'traffic'

export interface Recommendation {
  icon: string
  title: string
  reason: string
  chip: string
  tone: PlanTone
}

/** Build up to 4 prioritized recommendations from the real data available. */
export function buildRecommendations(f: PlanFacts): Recommendation[] {
  const recs: Recommendation[] = []

  if (f.winningFormat) {
    recs.push({
      icon: 'film',
      title: `Duplicar ${f.winningFormat}`,
      reason: 'Es el formato que más alcance generó este período.',
      chip: '+ alcance',
      tone: 'up',
    })
  }
  if (f.bestTime) {
    recs.push({
      icon: 'timer',
      title: `Publicar ${f.bestTime}`,
      reason: 'Es cuando tu audiencia está más activa, según Metricool.',
      chip: 'mejor hora',
      tone: 'time',
    })
  }
  if (f.saves > 0) {
    recs.push({
      icon: 'bookmark',
      title: 'Más contenido que se guarda',
      reason: `Generaste ${f.saves.toLocaleString('es-ES')} guardados — señal de contenido valioso.`,
      chip: '+ guardados',
      tone: 'save',
    })
  }
  if (f.clicks > 0) {
    recs.push({
      icon: 'mouse-pointer-click',
      title: 'Reforzar el llamado a la acción',
      reason: `Tu contenido movió ${f.clicks.toLocaleString('es-ES')} clics al enlace — con un CTA claro lo crecemos.`,
      chip: '+ tráfico',
      tone: 'traffic',
    })
  }

  // Ensure at least 2 recommendations: fall back to a cadence/momentum tip.
  if (recs.length < 2) {
    const up = f.reachDeltaPct != null && f.reachDeltaPct >= 0
    recs.push({
      icon: 'trending-up',
      title: up ? 'Mantener el ritmo de publicación' : 'Subir la frecuencia de publicación',
      reason: up
        ? 'El alcance viene creciendo; sostener la constancia consolida el resultado.'
        : 'Más publicaciones consistentes ayudan a recuperar y crecer el alcance.',
      chip: 'constancia',
      tone: 'up',
    })
  }

  return recs.slice(0, 4)
}
