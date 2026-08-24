/**
 * Stable per-client accent. Prefer `brand_colors.primary` from the clients
 * table; otherwise a deterministic hash of `client_id` so Speedy Net is
 * always the same hue across renders.
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

export type ClientAccent = {
  name: string
  dot: string
  ring: string
  soft: string
  text: string
}

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

function normalizeHex(raw: string): string | null {
  const s = raw.trim()
  if (!HEX.test(s)) return null
  if (s.length === 4) {
    return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`.toLowerCase()
  }
  return s
}

function hexToRgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`
}

export function clientAccent(clientId: string | null | undefined): ClientAccent {
  if (!clientId) return ACCENTS[5]
  let h = 0
  for (let i = 0; i < clientId.length; i++) h = (h * 31 + clientId.charCodeAt(i)) >>> 0
  return ACCENTS[h % ACCENTS.length]
}

export function clientCardColor(client: {
  id?: string | null
  brandColor?: string | null
  brand_colors?: { primary?: string | null } | null
}): ClientAccent {
  const raw = client.brandColor ?? client.brand_colors?.primary ?? null
  const hex = raw ? normalizeHex(raw) : null
  if (hex) {
    return { name: 'brand', dot: hex, ring: hexToRgba(hex, 0.4), soft: hexToRgba(hex, 0.12), text: hex }
  }
  return clientAccent(client.id)
}
