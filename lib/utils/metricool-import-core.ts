/**
 * Pure logic for importing Metricool brands as dashboard clients. Decides which
 * Metricool brands are NOT yet represented in the clients table, so the owner
 * only sees the ones worth adding. Matched by Metricool blog id (the `id`) or by
 * a loosely-normalized client name. Kept Supabase-free for unit testing.
 */
export interface BrandLike {
  id: string
  name: string
  provider?: string
}

export interface ClientLike {
  name: string
  metricool_blog_id?: string | null
}

// Loose name match: lowercase, strip accents, treat & like "and", drop
// punctuation — so "Beyond PVC Cabinets & Closets" matches the client
// "Beyond PVC Cabinets and Closets" and accents/apostrophes don't split them.
const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')

export function diffImportableBrands(brands: BrandLike[], clients: ClientLike[]): BrandLike[] {
  const linkedIds = new Set(
    clients.map((c) => c.metricool_blog_id?.trim()).filter((x): x is string => !!x),
  )
  const names = new Set(clients.map((c) => norm(c.name)))

  const seen = new Set<string>()
  const out: BrandLike[] = []
  for (const b of brands) {
    const id = String(b.id ?? '').trim()
    if (!id || !b.name?.trim() || seen.has(id)) continue
    seen.add(id)
    if (linkedIds.has(id)) continue // already linked to a client
    if (names.has(norm(b.name))) continue // a client already has this name
    out.push({ id, name: b.name.trim(), provider: b.provider })
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, 'es'))
}
