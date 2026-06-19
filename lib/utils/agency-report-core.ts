/**
 * Pure helpers for the agency-wide report: turn Metricool /stats/aggregations
 * objects into per-client reach + impressions, and rank clients.
 */
import { pickReach } from './reach-core'

function num(o: unknown, key: string): number {
  const v = o && typeof o === 'object' ? (o as Record<string, unknown>)[key] : undefined
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0
}

export interface ClientMetrics {
  reach: number
  impressions: number
}

/**
 * Combine Instagram + Facebook aggregation objects into reach (unique people)
 * and impressions. Reach uses true reach keys (pickReach); impressions use
 * IG `views` + FB `page_posts_impressions`.
 */
export function aggregateClientMetrics(ig: unknown, fb: unknown): ClientMetrics {
  return {
    reach: pickReach(ig) + pickReach(fb),
    impressions: num(ig, 'views') + num(fb, 'page_posts_impressions'),
  }
}

export interface AgencyRow {
  id: string
  name: string
  reach: number
  impressions: number
}

export function rankByReach(rows: AgencyRow[]): AgencyRow[] {
  return [...rows].sort((a, b) => b.reach - a.reach || b.impressions - a.impressions)
}

export interface AgencyTotals {
  clients: number
  clientsWithData: number
  reach: number
  impressions: number
}

export function agencyTotals(rows: AgencyRow[]): AgencyTotals {
  return {
    clients: rows.length,
    clientsWithData: rows.filter((r) => r.reach > 0 || r.impressions > 0).length,
    reach: rows.reduce((a, r) => a + r.reach, 0),
    impressions: rows.reduce((a, r) => a + r.impressions, 0),
  }
}
