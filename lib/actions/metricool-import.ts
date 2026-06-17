'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/server'
import { getServerConfig } from '@/lib/metricool/post'
import { getProfiles } from '@/lib/metricool/client'
import { diffImportableBrands, type BrandLike } from '@/lib/utils/metricool-import-core'

/**
 * Owner/Supervisor: list Metricool brands that aren't yet dashboard clients, so
 * the owner can add them in one click instead of retyping.
 */
export async function getImportableMetricoolBrands(): Promise<{ brands?: BrandLike[]; error?: string }> {
  try {
    await requirePermission('clients.create')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }

  const config = getServerConfig()
  if (!config) return { error: 'Metricool no está configurado en el servidor.' }

  let profiles
  try {
    profiles = await getProfiles(config)
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No se pudo consultar Metricool.' }
  }

  const supabase = await createClient()
  const { data: clients } = await supabase.from('clients').select('name, metricool_blog_id')

  // Metricool brands expose the display name as `label` (not `name`); skip
  // deleted/demo brands.
  const mapped = (profiles ?? [])
    .filter((p) => !(p as Record<string, unknown>).deleted && !(p as Record<string, unknown>).isDemo)
    .map((p) => {
      const r = p as Record<string, unknown>
      return { id: String(p.id), name: String(r.label ?? r.title ?? p.name ?? '').trim() }
    })

  const brands = diffImportableBrands(
    mapped,
    (clients ?? []) as { name: string; metricool_blog_id: string | null }[],
  )
  return { brands }
}

/**
 * Create a dashboard client for each selected Metricool brand (name + linked
 * blog id). Skips any brand whose blog id or name already exists. Returns how
 * many were created.
 */
export async function importMetricoolBrands(
  selected: { id: string; name: string }[],
): Promise<{ imported?: number; error?: string }> {
  try {
    await requirePermission('clients.create')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }
  if (selected.length === 0) return { imported: 0 }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: existing } = await supabase.from('clients').select('name, metricool_blog_id')
  const linkedIds = new Set((existing ?? []).map((c) => (c.metricool_blog_id as string | null)?.trim()).filter(Boolean))
  const names = new Set((existing ?? []).map((c) => (c.name as string).trim().toLowerCase()))

  const rows = selected
    .filter((b) => b.id && b.name?.trim() && !linkedIds.has(b.id) && !names.has(b.name.trim().toLowerCase()))
    .map((b) => ({ name: b.name.trim(), metricool_blog_id: b.id, status: 'active', created_by: user.id }))

  if (rows.length === 0) return { imported: 0 }

  const { error } = await supabase.from('clients').insert(rows)
  if (error) return { error: error.message }

  revalidatePath('/clients')
  return { imported: rows.length }
}
