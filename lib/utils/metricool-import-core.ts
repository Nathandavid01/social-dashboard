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

/** Rank Metricool blogs for linking to an existing client by loose name match. */
export function suggestMetricoolBlogs(
  clientName: string,
  blogs: BrandLike[],
  opts?: { limit?: number },
): BrandLike[] {
  const target = norm(clientName)
  if (!target) return []
  const limit = opts?.limit ?? 5
  const scored = blogs
    .map((b) => {
      const n = norm(b.name)
      let score = 0
      if (!n) score = 0
      else if (n === target) score = 100
      else if (n.includes(target) || target.includes(n)) score = 80
      else {
        const tw = new Set(target.split(' '))
        const bw = n.split(' ')
        const hit = bw.filter((w) => tw.has(w)).length
        score = hit === 0 ? 0 : Math.round((hit / Math.max(tw.size, bw.length)) * 60)
      }
      return { b, score }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.b.name.localeCompare(b.b.name, 'es'))
  return scored.slice(0, limit).map((x) => x.b)
}
