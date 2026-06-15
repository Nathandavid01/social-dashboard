/**
 * Pure logic for importing Metricool brands as dashboard clients. Decides which
 * Metricool brands are NOT yet represented in the clients table, so the owner
 * only sees the ones worth adding. Matched by Metricool blog id (the `id`) or by
 * a case-insensitive client name. Kept Supabase-free for unit testing.
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

const norm = (s: string) => s.trim().toLowerCase()

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
