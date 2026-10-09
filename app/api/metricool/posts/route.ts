import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { currentUserHas } from '@/lib/auth/server'
import { getScheduledPosts } from '@/lib/metricool/scheduler'

export const dynamic = 'force-dynamic'
export const maxDuration = 60
export interface PublishedPost {
  id: number
  uuid: string
  text: string
  publicationDate: string
  timezone: string
  platforms: string[]
  providerStatuses?: string[]
  providers?: { network: string; status: string; detailedStatus?: string; publicUrl?: string }[]
  draft: boolean
  autoPublish: boolean
  media: { url?: string; type?: string }[]
  clientName?: string
  clientId?: string
  blogId: string
}
const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } })
async function fetchMetricoolPosts(blogId: string, start: string, end: string): Promise<PublishedPost[]> {
  const posts = await getScheduledPosts({ userToken: process.env.METRICOOL_TOKEN!, userId: process.env.METRICOOL_USER_ID!, blogId }, start, end)
  return posts.map(p => ({
    id: p.id, uuid: p.uuid, text: p.text || '',
    publicationDate: p.publicationDate?.dateTime || '',
    timezone: p.publicationDate?.timezone || 'America/Puerto_Rico',
    platforms: (p.providers || []).map(x => x.network),
    providerStatuses: (p.providers || []).map(x => x.status ?? 'UNKNOWN'),
    providers: (p.providers || []).map(x => ({ network: x.network, status: x.status ?? 'UNKNOWN', detailedStatus: x.detailedStatus, publicUrl: x.publicUrl })),
    draft: p.draft, autoPublish: p.autoPublish,
    media: (p.media || []) as PublishedPost['media'], blogId,
  }))
}
export async function GET(req: NextRequest) {
  if (!await currentUserHas('metricool.read')) return json({ error: 'Acceso denegado' }, 403)
  if (!process.env.METRICOOL_TOKEN || !process.env.METRICOOL_USER_ID) return json({ error: 'Metricool no está configurado.' }, 503)
  const { searchParams } = new URL(req.url)
  const blogId = searchParams.get('blogId')
  const includeDrafts = searchParams.get('includeDrafts') === 'true'
  const all = searchParams.get('all') === 'true'
  const todayOnly = searchParams.get('today') === 'true'
  const startParam = searchParams.get('startDate'), endParam = searchParams.get('endDate')
  let start: Date, end: Date
  if (startParam || endParam) {
    const valid = (date: string | null) => !!date && /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(`${date}T00:00:00Z`)) && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date
    if (!valid(startParam) || !valid(endParam) || startParam! > endParam!) return json({ error: 'Rango de fechas inválido.' }, 400)
    start = new Date(`${startParam}T00:00:00Z`); end = new Date(`${endParam}T23:59:59Z`)
  } else {
    start = new Date(); end = new Date()
    if (todayOnly) {
      const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Puerto_Rico' }).format(start)
      start = new Date(`${day}T00:00:00Z`); end = new Date(`${day}T23:59:59Z`)
    } else {
      const ranges: Record<string, number> = { '7d': 7, '14d': 14, '30d': 30, '90d': 90, '180d': 180 }
      start.setUTCDate(start.getUTCDate() - (ranges[searchParams.get('range') || '30d'] ?? 30))
      end.setUTCDate(end.getUTCDate() + 30)
    }
  }
  const startStr = start.toISOString().slice(0, 19), endStr = end.toISOString().slice(0, 19)
  const sort = (posts: PublishedPost[]) => posts.filter(p => includeDrafts || !p.draft).sort((a, b) => todayOnly ? a.publicationDate.localeCompare(b.publicationDate) : b.publicationDate.localeCompare(a.publicationDate))
  try {
    const supabase = await createClient()
    if (all) {
      const { data: clients, error } = await supabase.from('clients').select('id, name, metricool_blog_id').not('metricool_blog_id', 'is', null).eq('status', 'active')
      if (error) return json({ error: 'No se pudo consultar los clientes.' }, 502)
      const clientsToCheck = clients ?? []
      // One read per Metricool account, even when clients share a blog.
      const queries = new Map<string, Promise<PublishedPost[]>>()
      const results = await Promise.allSettled(clientsToCheck.map(async c => {
        const id = c.metricool_blog_id!
        if (!queries.has(id)) queries.set(id, fetchMetricoolPosts(id, startStr, endStr))
        return (await queries.get(id)!).map(p => ({ ...p, clientName: c.name, clientId: c.id }))
      }))
      const failedClients = results.flatMap((r, i) => r.status === 'rejected' ? [{ id: clientsToCheck[i].id, name: clientsToCheck[i].name }] : [])
      const posts = results.flatMap(r => r.status === 'fulfilled' ? r.value : [])
      if (clientsToCheck.length && failedClients.length === clientsToCheck.length) return json({ error: 'No se pudo verificar Metricool.', failedClients, complete: false }, 502)
      return json({ posts: sort(posts), clientCount: clientsToCheck.length, checkedAt: new Date().toISOString(), complete: failedClients.length === 0, failedClients })
    }
    const effectiveBlogId = blogId || process.env.METRICOOL_BLOG_ID
    if (!effectiveBlogId) return json({ error: 'Selecciona un cliente conectado a Metricool.' }, 503)
    let clientName: string | undefined, clientId: string | undefined
    if (blogId) {
      const { data: c, error } = await supabase.from('clients').select('id, name').eq('metricool_blog_id', blogId).eq('status', 'active').order('name').order('id').limit(1).maybeSingle()
      if (error || !c) return json({ error: 'Cliente de Metricool no disponible.' }, 404)
      clientName = c.name; clientId = c.id
    }
    const posts = await fetchMetricoolPosts(effectiveBlogId, startStr, endStr)
    return json({ posts: sort(posts).map(p => ({ ...p, clientName, clientId })), checkedAt: new Date().toISOString(), complete: true, failedClients: [] })
  } catch {
    return json({ error: 'No se pudo verificar Metricool. Intenta nuevamente.', complete: false }, 502)
  }
}
