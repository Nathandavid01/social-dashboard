'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { inferCadenceFromMetricoolPosts, type InferredCadence, type MetricoolPostMinimal } from '@/lib/utils/metricool-cadence'

interface ClientWithBlog {
  id: string
  name: string
  posting_days: number[] | null
  metricool_blog_id: string | null
}

export interface CadenceRow {
  clientId: string
  clientName: string
  blogId: string | null
  configuredDays: number[]
  inferred: InferredCadence | null
  /** Days that are in inferred.activeDays but NOT in configuredDays — opportunities. */
  newSuggestedDays: number[]
  /** Days that ARE in configuredDays but never appeared in history — drift. */
  configuredButUnused: number[]
  error?: string
}

const METRICOOL_BASE = 'https://app.metricool.com/api/v2'

const WINDOW_DAYS = 56 // 8 weeks

async function fetchPosts(blogId: string, days = WINDOW_DAYS): Promise<MetricoolPostMinimal[] | { error: string }> {
  const token = process.env.METRICOOL_TOKEN
  const userId = process.env.METRICOOL_USER_ID
  if (!token || !userId) return { error: 'Metricool no configurado' }

  const end = new Date()
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000)
  const startStr = start.toISOString().slice(0, 19)
  const endStr = end.toISOString().slice(0, 19)

  const url = `${METRICOOL_BASE}/scheduler/posts?userId=${userId}&blogId=${blogId}&start=${startStr}&end=${endStr}`
  try {
    const res = await fetch(url, { headers: { 'X-Mc-Auth': token } })
    if (!res.ok) return { error: `Metricool ${res.status}` }
    const json = (await res.json()) as { data?: MetricoolPostMinimal[] }
    return json.data ?? []
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error de red' }
  }
}

export async function inferAllActiveCadences(): Promise<CadenceRow[]> {
  const supabase = await createClient()
  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, posting_days, metricool_blog_id')
    .eq('status', 'active')
    .order('name', { ascending: true })

  const rows: ClientWithBlog[] = (clients ?? []) as ClientWithBlog[]

  // Concurrency: process in chunks of 6 to avoid hammering Metricool.
  const CHUNK = 6
  const out: CadenceRow[] = []

  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK)
    const results = await Promise.all(
      chunk.map(async (c): Promise<CadenceRow> => {
        const configured = c.posting_days ?? []
        if (!c.metricool_blog_id) {
          return {
            clientId: c.id,
            clientName: c.name,
            blogId: null,
            configuredDays: configured,
            inferred: null,
            newSuggestedDays: [],
            configuredButUnused: [],
          }
        }
        const posts = await fetchPosts(c.metricool_blog_id, 60)
        if (!Array.isArray(posts)) {
          return {
            clientId: c.id,
            clientName: c.name,
            blogId: c.metricool_blog_id,
            configuredDays: configured,
            inferred: null,
            newSuggestedDays: [],
            configuredButUnused: [],
            error: posts.error,
          }
        }
        const inferred = inferCadenceFromMetricoolPosts(posts, { windowDays: 60 })
        const newSuggestedDays = inferred.activeDays.filter((d) => !configured.includes(d))
        const configuredButUnused = configured.filter(
          (d) => (inferred.countByDayOfWeek[d] ?? 0) === 0 && inferred.totalCounted > 0,
        )
        return {
          clientId: c.id,
          clientName: c.name,
          blogId: c.metricool_blog_id,
          configuredDays: configured,
          inferred,
          newSuggestedDays,
          configuredButUnused,
        }
      }),
    )
    out.push(...results)
  }

  return out
}

export async function inferClientCadence(clientId: string): Promise<CadenceRow | null> {
  const supabase = await createClient()
  const { data: c } = await supabase
    .from('clients')
    .select('id, name, posting_days, metricool_blog_id')
    .eq('id', clientId)
    .single()
  if (!c) return null

  const configured = (c.posting_days as number[] | null) ?? []
  if (!c.metricool_blog_id) {
    return {
      clientId: c.id,
      clientName: c.name,
      blogId: null,
      configuredDays: configured,
      inferred: null,
      newSuggestedDays: [],
      configuredButUnused: [],
    }
  }
  const posts = await fetchPosts(c.metricool_blog_id, 60)
  if (!Array.isArray(posts)) {
    return {
      clientId: c.id,
      clientName: c.name,
      blogId: c.metricool_blog_id,
      configuredDays: configured,
      inferred: null,
      newSuggestedDays: [],
      configuredButUnused: [],
      error: posts.error,
    }
  }
  const inferred = inferCadenceFromMetricoolPosts(posts, { windowDays: 60 })
  return {
    clientId: c.id,
    clientName: c.name,
    blogId: c.metricool_blog_id,
    configuredDays: configured,
    inferred,
    newSuggestedDays: inferred.activeDays.filter((d) => !configured.includes(d)),
    configuredButUnused: configured.filter((d) => (inferred.countByDayOfWeek[d] ?? 0) === 0 && inferred.totalCounted > 0),
  }
}

export async function adoptInferredCadence(clientId: string, days: number[]): Promise<{ ok?: true; error?: string }> {
  const supabase = await createClient()
  const clean = Array.from(new Set(days.filter((d) => d >= 0 && d <= 6))).sort()
  const { error } = await supabase
    .from('clients')
    .update({ posting_days: clean, updated_at: new Date().toISOString() })
    .eq('id', clientId)
  if (error) return { error: error.message }
  revalidatePath(`/clients/${clientId}`)
  revalidatePath('/clients/cadence')
  revalidatePath('/home')
  return { ok: true }
}

export interface AutoApplyResult {
  clientId: string
  clientName: string
  applied: boolean
  reason?: string
  changes?: {
    posting_days?: { from: number[]; to: number[] }
    posting_time?: { from: string | null; to: string | null }
    default_platforms?: { from: string[]; to: string[] }
  }
}

/**
 * For every active client with metricool_blog_id, infer their profile from the
 * last 56 days of Metricool history and patch the row with:
 *   - posting_days       ← activeDays
 *   - posting_time       ← typicalTimeOverall ("HH:MM")
 *   - default_platforms  ← topPlatforms (≥ 20% of volume)
 * Returns a summary of what changed.
 */
export async function applyInferredProfileToAll(): Promise<AutoApplyResult[]> {
  const supabase = await createClient()
  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, posting_days, posting_time, default_platforms, metricool_blog_id')
    .eq('status', 'active')
    .order('name', { ascending: true })

  const rows = (clients ?? []) as Array<{
    id: string
    name: string
    posting_days: number[] | null
    posting_time: string | null
    default_platforms: string[] | null
    metricool_blog_id: string | null
  }>

  const CHUNK = 6
  const out: AutoApplyResult[] = []

  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK)
    const results = await Promise.all(
      chunk.map(async (c): Promise<AutoApplyResult> => {
        if (!c.metricool_blog_id) {
          return { clientId: c.id, clientName: c.name, applied: false, reason: 'Sin metricool_blog_id' }
        }
        const posts = await fetchPosts(c.metricool_blog_id, 56)
        if (!Array.isArray(posts)) {
          return { clientId: c.id, clientName: c.name, applied: false, reason: posts.error }
        }
        const inf = inferCadenceFromMetricoolPosts(posts, { windowDays: 56 })
        if (inf.totalCounted === 0) {
          return { clientId: c.id, clientName: c.name, applied: false, reason: 'Sin historial reciente' }
        }

        const patch: Record<string, unknown> = {}
        const changes: AutoApplyResult['changes'] = {}

        if (inf.activeDays.length > 0 && !sameDays(c.posting_days ?? [], inf.activeDays)) {
          patch.posting_days = inf.activeDays
          changes.posting_days = { from: c.posting_days ?? [], to: inf.activeDays }
        }
        if (inf.typicalTimeOverall && c.posting_time !== inf.typicalTimeOverall) {
          patch.posting_time = inf.typicalTimeOverall
          changes.posting_time = { from: c.posting_time, to: inf.typicalTimeOverall }
        }
        if (inf.topPlatforms.length > 0 && !samePlatforms(c.default_platforms ?? [], inf.topPlatforms)) {
          patch.default_platforms = inf.topPlatforms
          changes.default_platforms = { from: c.default_platforms ?? [], to: inf.topPlatforms }
        }

        if (Object.keys(patch).length === 0) {
          return { clientId: c.id, clientName: c.name, applied: false, reason: 'Ya estaba sincronizado' }
        }

        patch.updated_at = new Date().toISOString()
        const { error } = await supabase.from('clients').update(patch).eq('id', c.id)
        if (error) return { clientId: c.id, clientName: c.name, applied: false, reason: error.message }
        return { clientId: c.id, clientName: c.name, applied: true, changes }
      }),
    )
    out.push(...results)
  }

  revalidatePath('/clients')
  revalidatePath('/clients/cadence')
  revalidatePath('/home')
  return out
}

function sameDays(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false
  const sa = [...a].sort()
  const sb = [...b].sort()
  return sa.every((v, i) => v === sb[i])
}

function samePlatforms(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const sa = [...a].sort()
  const sb = [...b].sort()
  return sa.every((v, i) => v === sb[i])
}
