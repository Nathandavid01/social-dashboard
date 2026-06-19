/**
 * Pure helpers for friendly client-upload links: /subir/<client-name-slug>.
 * Backward-compatible — a raw client UUID still resolves. Kept pure so the
 * slugging + resolution are unit-testable.
 */

export function slugifyClientName(name: string): string {
  return (name ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Resolve a URL ref (a client UUID or a name slug) to a client id.
 * - exact UUID that exists → that id
 * - otherwise a name slug that matches EXACTLY ONE client → that id
 * - ambiguous (same slug for 2+ clients) or no match → null (never guess, so an
 *   upload can't land on the wrong client)
 */
export function resolveClientId(
  ref: string,
  clients: { id: string; name: string }[],
): string | null {
  const r = (ref ?? '').trim()
  if (!r) return null
  if (UUID_RE.test(r) && clients.some((c) => c.id === r)) return r

  const target = slugifyClientName(r)
  if (!target) return null
  const matches = clients.filter((c) => slugifyClientName(c.name) === target)
  return matches.length === 1 ? matches[0].id : null
}
