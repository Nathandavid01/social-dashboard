import 'server-only'

import { unstable_cache } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/server'
import { getScheduledPosts } from '@/lib/metricool/scheduler'
import { buildClientVideoInventory, type InventoryClient, type InventoryIdea, type InventoryPost } from './client-video-inventory'

const PAGE_SIZE = 500

/** Paginate all tables; Supabase's row cap must not silently truncate counts. */
async function allRows<T>(db: Awaited<ReturnType<typeof createClient>>, table: string, columns: string, order: string): Promise<T[]> {
  const rows: T[] = []
  for (let start = 0; ; start += PAGE_SIZE) {
    const { data, error } = await db.from(table).select(columns).order(order).range(start, start + PAGE_SIZE - 1)
    if (error) throw new Error(`No se pudo consultar el inventario (${table}).`)
    rows.push(...((data ?? []) as unknown as T[]))
    if ((data?.length ?? 0) < PAGE_SIZE) return rows
  }
}

async function calendarForClient(client: InventoryClient, start: string, end: string): Promise<InventoryPost[] | null> {
  if (!client.metricool_blog_id) return []
  const userToken = process.env.METRICOOL_TOKEN?.trim()
  const userId = process.env.METRICOOL_USER_ID?.trim()
  if (!userToken || !userId) return null
  try {
    // Permission is checked before cache access. No credentials are cache keys.
    return await unstable_cache(() => getScheduledPosts({ userToken, userId, blogId: client.metricool_blog_id! }, start, end),
      ['client-video-inventory-calendar-v1', userId, client.metricool_blog_id, start, end], { revalidate: 300 })()
  } catch {
    return null
  }
}

export async function getClientVideoInventory() {
  await requirePermission('inventory.read')
  const db = await createClient()
  const [clients, ideas, profiles, assignments] = await Promise.all([
    allRows<InventoryClient>(db, 'clients', 'id,name,status,assigned_to,edit_mode,metricool_blog_id', 'id'),
    allRows<InventoryIdea>(db, 'content_ideas', 'id,client_id,content_type,status,published_at,manual_posted_status,metricool_post_id,posted_at,videos:content_idea_videos!content_idea_videos_idea_id_fkey(kind,status,drive_file_id,mime_type,name)', 'id'),
    allRows<{ id: string; full_name: string | null }>(db, 'profiles', 'id,full_name', 'id'),
    allRows<{ client_id: string; editor_id: string }>(db, 'client_editor_assignments', 'client_id,editor_id', 'client_id,editor_id'),
  ])
  const now = new Date()
  const year = Number(now.toLocaleDateString('en-US', { year: 'numeric', timeZone: 'America/Puerto_Rico' }))
  const start = `${year - 1}-01-01T00:00:00`
  const end = `${year + 1}-12-31T23:59:59`
  const calendar: Record<string, InventoryPost[] | null> = {}
  for (let offset = 0; offset < clients.length; offset += 6) {
    await Promise.all(clients.slice(offset, offset + 6).map(async (client) => {
      calendar[client.id] = await calendarForClient(client, start, end)
    }))
  }
  return { rows: buildClientVideoInventory({ clients, ideas, profiles, assignments, calendar }), checkedAt: now.toISOString() }
}
