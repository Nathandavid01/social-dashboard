/**
 * Pure helpers for the professional client report: chart buckets, top posts,
 * and the AI executive-summary prompt + deterministic fallback. No network here
 * so it's all unit-testable.
 */
import type { ReportPost } from './client-report-core'
import { formatCompact } from './client-report-core'

export function reachByNetwork(posts: ReportPost[]): { instagram: number; facebook: number } {
  let instagram = 0
  let facebook = 0
  for (const p of posts) {
    if (p.network === 'instagram') instagram += p.reach
    else facebook += p.reach
  }
  return { instagram, facebook }
}

export interface ReachBucket {
  label: string
  reach: number
}

/** Bucket post reach across the window into ~weekly (or daily for 7d) bars. */
export function reachTimeline(posts: ReportPost[], periodDays: number, now: number): ReachBucket[] {
  const buckets = periodDays <= 7 ? 7 : Math.min(13, Math.ceil(periodDays / 7))
  const windowMs = periodDays * 24 * 60 * 60 * 1000
  const startMs = now - windowMs
  const width = windowMs / buckets
  const out: ReachBucket[] = Array.from({ length: buckets }, (_, i) => {
    const d = new Date(startMs + i * width)
    return { label: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`, reach: 0 }
  })
  for (const p of posts) {
    if (!p.timestamp || p.timestamp < startMs || p.timestamp > now) continue
    const idx = Math.min(buckets - 1, Math.max(0, Math.floor((p.timestamp - startMs) / width)))
    out[idx].reach += p.reach
  }
  return out
}

export function topPosts(posts: ReportPost[], n: number): ReportPost[] {
  return [...posts].sort((a, b) => b.reach - a.reach).slice(0, Math.max(0, n))
}

/** Which content type drove the most reach, as a Spanish label. */
export function topContentType(posts: ReportPost[]): string {
  const tally: Record<string, number> = {}
  for (const p of posts) {
    const key = p.network === 'facebook' ? 'Facebook' : p.type === 'reel' ? 'Reels' : 'Posts de Instagram'
    tally[key] = (tally[key] ?? 0) + p.reach
  }
  const best = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]
  return best && best[1] > 0 ? best[0] : '—'
}

export interface InsightFacts {
  clientName: string
  periodDays: number
  reach: number
  reachDeltaPct: number | null
  impressions: number
  engagement: number
  posts: number
  igPosts: number
  fbPosts: number
  topContentType: string
  bestPostReach: number
  bestPostExcerpt: string
}

export function buildInsightPrompt(f: InsightFacts): string {
  const delta =
    f.reachDeltaPct == null
      ? 'sin comparación de período previo'
      : `${f.reachDeltaPct >= 0 ? 'subió' : 'bajó'} ${Math.abs(Math.round(f.reachDeltaPct))}% vs el período anterior`
  return [
    `Eres el estratega de Nate Media (agencia de social media) escribiendo el resumen ejecutivo de un reporte PARA EL CLIENTE "${f.clientName}".`,
    `Datos de los últimos ${f.periodDays} días: alcance ${f.reach} personas (${delta}); impresiones ${f.impressions}; interacciones ${f.engagement}; ${f.posts} publicaciones (${f.igPosts} Instagram, ${f.fbPosts} Facebook). El formato que más alcance generó: ${f.topContentType}. Mejor publicación: ${f.bestPostReach} de alcance — "${f.bestPostExcerpt}".`,
    `Escribe en español, tono profesional de agencia a cliente, SIN emojis y SIN inventar datos. Exactamente 3 párrafos cortos con estos encabezados en negrita markdown:`,
    `**Lo que logramos** — qué pasó este período en números claros. **Qué está funcionando** — qué tipo de contenido/estrategia está rindiendo. **Hacia dónde vamos** — la recomendación/dirección para el próximo período. Máximo ~110 palabras en total.`,
  ].join('\n\n')
}

export function fallbackInsight(f: InsightFacts): string {
  const trend =
    f.reachDeltaPct == null
      ? 'es nuestra línea base para comparar hacia adelante'
      : f.reachDeltaPct >= 0
        ? `creció ${Math.round(f.reachDeltaPct)}% frente al período anterior`
        : `bajó ${Math.abs(Math.round(f.reachDeltaPct))}% frente al período anterior`
  return [
    `**Lo que logramos** — En los últimos ${f.periodDays} días publicamos ${f.posts} piezas que alcanzaron a ${formatCompact(f.reach)} personas (${trend}), con ${formatCompact(f.engagement)} interacciones.`,
    `**Qué está funcionando** — ${f.topContentType} es el formato que más alcance está generando para la marca; ahí concentramos la mejor respuesta de la audiencia.`,
    `**Hacia dónde vamos** — Mantendremos el ritmo de publicación y duplicaremos lo que funciona (${f.topContentType}) para seguir creciendo el alcance el próximo período.`,
  ].join('\n\n')
}
