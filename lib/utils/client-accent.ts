/**
 * Stable per-client accent color for the pipeline board chips and card rails,
 * matching the reference design where each client has its own hue. Derived
 * deterministically from the client id so it's consistent across renders without
 * needing brand_colors wired up yet (that comes in a later phase).
 */
const ACCENTS = [
  { name: 'emerald', dot: '#10b981', ring: 'rgba(16,185,129,0.4)', soft: 'rgba(16,185,129,0.12)', text: '#34d399' },
  { name: 'amber', dot: '#f59e0b', ring: 'rgba(245,158,11,0.4)', soft: 'rgba(245,158,11,0.12)', text: '#fbbf24' },
  { name: 'rose', dot: '#f43f5e', ring: 'rgba(244,63,94,0.4)', soft: 'rgba(244,63,94,0.12)', text: '#fb7185' },
  { name: 'cyan', dot: '#06b6d4', ring: 'rgba(6,182,212,0.4)', soft: 'rgba(6,182,212,0.12)', text: '#22d3ee' },
  { name: 'violet', dot: '#8b5cf6', ring: 'rgba(139,92,246,0.4)', soft: 'rgba(139,92,246,0.12)', text: '#a78bfa' },
  { name: 'sky', dot: '#0ea5e9', ring: 'rgba(14,165,233,0.4)', soft: 'rgba(14,165,233,0.12)', text: '#38bdf8' },
  { name: 'orange', dot: '#fb923c', ring: 'rgba(251,146,60,0.4)', soft: 'rgba(251,146,60,0.12)', text: '#fdba74' },
  { name: 'lime', dot: '#84cc16', ring: 'rgba(132,204,22,0.4)', soft: 'rgba(132,204,22,0.12)', text: '#a3e635' },
] as const

export type ClientAccent = (typeof ACCENTS)[number]

export function clientAccent(clientId: string | null | undefined): ClientAccent {
  if (!clientId) return ACCENTS[5]
  let h = 0
  for (let i = 0; i < clientId.length; i++) h = (h * 31 + clientId.charCodeAt(i)) >>> 0
  return ACCENTS[h % ACCENTS.length]
}
