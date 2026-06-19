/**
 * Pure helpers to normalize Metricool audience demographics
 * (/stats/{gender,age,country,city}/{network}) into percentages + top lists.
 */

function obj(x: unknown): Record<string, unknown> {
  return x && typeof x === 'object' ? (x as Record<string, unknown>) : {}
}
function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0
}
function pct(v: number, total: number): number {
  return total > 0 ? Math.round((v / total) * 100) : 0
}

export interface GenderSplit {
  femalePct: number
  malePct: number
  total: number
}

/** Metricool gender map {M,F,U} → female/male percentages (U excluded from the split). */
export function genderSplit(map: unknown): GenderSplit {
  const m = obj(map)
  const F = num(m.F)
  const M = num(m.M)
  const known = F + M
  return { femalePct: pct(F, known), malePct: pct(M, known), total: F + M + num(m.U) }
}

export interface AgeBucket {
  label: string
  value: number
  pct: number
}

const AGE_ORDER = ['13-17', '18-24', '25-34', '35-44', '45-54', '55-64', '65+']

export function ageBuckets(map: unknown): AgeBucket[] {
  const m = obj(map)
  const total = AGE_ORDER.reduce((a, k) => a + num(m[k]), 0)
  return AGE_ORDER.map((k) => ({ label: k, value: num(m[k]), pct: pct(num(m[k]), total) })).filter(
    (b) => b.value > 0,
  )
}

export interface TopItem {
  label: string
  value: number
  pct: number
}

/** Top N entries of a {label: count} map, as percentages. `cityShort` keeps the
 * first segment of "San Juan, San Juan" → "San Juan". */
export function topItems(map: unknown, n: number, opts: { cityShort?: boolean } = {}): TopItem[] {
  const m = obj(map)
  const entries = Object.entries(m)
    .map(([k, v]) => [k, num(v)] as [string, number])
    .filter(([, v]) => v > 0)
  const total = entries.reduce((a, [, v]) => a + v, 0)
  entries.sort((a, b) => b[1] - a[1])
  return entries.slice(0, Math.max(0, n)).map(([k, v]) => ({
    label: opts.cityShort ? k.split(',')[0].trim() : k,
    value: v,
    pct: pct(v, total),
  }))
}

export interface Demographics {
  gender: GenderSplit
  ages: AgeBucket[]
  topCities: TopItem[]
  hasData: boolean
}

/** Combine the raw maps into the report's audience block. */
export function buildDemographics(genderMap: unknown, ageMap: unknown, cityMap: unknown): Demographics {
  const gender = genderSplit(genderMap)
  const ages = ageBuckets(ageMap)
  const topCities = topItems(cityMap, 5, { cityShort: true })
  return { gender, ages, topCities, hasData: gender.total > 0 || ages.length > 0 || topCities.length > 0 }
}
