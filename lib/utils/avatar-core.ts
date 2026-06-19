/**
 * Pure helpers for the avatar creator. Generated avatars come from DiceBear
 * (https://www.dicebear.com) — stable public SVG URLs by style + seed, no key.
 * Kept pure so URL building + validation are unit-testable.
 */

export interface AvatarStyle {
  id: string
  label: string
}

/** Curated, professional-leaning DiceBear styles. */
export const AVATAR_STYLES: AvatarStyle[] = [
  { id: 'notionists', label: 'Ilustrado' },
  { id: 'avataaars', label: 'Cartoon' },
  { id: 'thumbs', label: 'Abstracto' },
  { id: 'glass', label: 'Glass' },
  { id: 'shapes', label: 'Geométrico' },
  { id: 'initials', label: 'Iniciales' },
]

const ALLOWED_HOST = 'api.dicebear.com'

export function dicebearUrl(style: string, seed: string): string {
  const s = AVATAR_STYLES.some((x) => x.id === style) ? style : AVATAR_STYLES[0].id
  return `https://${ALLOWED_HOST}/9.x/${s}/svg?seed=${encodeURIComponent(seed)}`
}

/** Only allow generated avatars from the DiceBear host (server-side guard). */
export function isAllowedAvatarUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && u.hostname === ALLOWED_HOST
  } catch {
    return false
  }
}

/** Deterministic starter seeds from the user's identity + an index. */
export function avatarSeeds(base: string, count: number): string[] {
  const safe = base.trim() || 'nate'
  return Array.from({ length: Math.max(0, count) }, (_, i) => (i === 0 ? safe : `${safe}-${i}`))
}

export function initialsFrom(name?: string | null, email?: string | null): string {
  const src = (name ?? '').trim()
  if (src) {
    const parts = src.split(/\s+/)
    return (parts.length > 1 ? parts[0][0] + parts[1][0] : parts[0].slice(0, 2)).toUpperCase()
  }
  return (email?.[0] ?? 'U').toUpperCase()
}
