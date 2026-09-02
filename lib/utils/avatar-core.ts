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

const FALLBACK_HOSTS = new Set([
  'ui-avatars.com',
  'www.ui-avatars.com',
  'gravatar.com',
  'www.gravatar.com',
  'secure.gravatar.com',
])

/**
 * A persisted URL counts as a real avatar only if it is a chosen/uploaded
 * image — not empty, not initials generators, not a generic placeholder.
 */
export function hasRealAvatar(url: string | null | undefined): boolean {
  if (!url || !url.trim()) return false
  try {
    const u = new URL(url.trim())
    if (u.protocol !== 'https:') return false
    const host = u.hostname.toLowerCase()
    const path = u.pathname.toLowerCase()
    if (FALLBACK_HOSTS.has(host) || host.endsWith('.ui-avatars.com')) return false
    if (host === 'api.dicebear.com' && path.includes('/initials/')) return false
    if (/placeholder|default-avatar|generic-avatar/.test(path)) return false
    return true
  } catch {
    return false
  }
}

/** Server gate: only the signed-in user may write their own profile photo. */
export function canUpdateOwnAvatar(
  actorId: string | null | undefined,
  targetUserId: string,
): boolean {
  return Boolean(actorId && targetUserId && actorId === targetUserId)
}

/** Show the setup prompt unless they already have a real photo or postponed this visit. */
export function shouldPromptForAvatar(
  avatarUrl: string | null | undefined,
  sessionPostponed: boolean,
): boolean {
  return !hasRealAvatar(avatarUrl) && !sessionPostponed
}

export const AVATAR_MAX_BYTES = 4 * 1024 * 1024

/** Misma regla para la foto propia y la que un owner pone a otro usuario. */
export function validateAvatarFile(file: File | null | undefined): { ok: true; file: File } | { ok: false; error: string } {
  if (!file || file.size === 0) return { ok: false, error: 'Archivo requerido' }
  if (!file.type.startsWith('image/')) return { ok: false, error: 'Solo se permiten imágenes' }
  if (file.size > AVATAR_MAX_BYTES) return { ok: false, error: 'Imagen mayor a 4 MB' }
  return { ok: true, file }
}

/** Ruta estable por usuario: re-subir sobreescribe; el cache-bust va en la URL. */
export function avatarStoragePath(userId: string, fileName: string): string {
  const ext = (fileName.split('.').pop() || 'jpg').toLowerCase()
  return `${userId}/avatar.${ext}`
}
