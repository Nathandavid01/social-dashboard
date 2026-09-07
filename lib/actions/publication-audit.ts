'use server'

import { requirePermission } from '@/lib/auth/server'
import { createClient } from '@/lib/supabase/server'
import { getServerConfig } from '@/lib/metricool/post'
import { getScheduledPosts } from '@/lib/metricool/scheduler'
import { addDaysISO, todayISOInTimeZone } from '@/lib/utils/deadlines'
import { summarizePublicationWindow, type PublicationAuditReport, type PublicationAuditRow } from '@/lib/utils/publication-audit'

/** Read-only: never promotes drafts, generates captions or sends posts. */
export async function auditUpcomingPublications(): Promise<{report?: PublicationAuditReport; error?: string}> {
  try {
    await requirePermission('metricool.read')
    const db = await createClient()
    const start = addDaysISO(todayISOInTimeZone('America/Puerto_Rico'), 1)
    const end = addDaysISO(start, 13)
    const [clients, ideas] = await Promise.all([
      db.from('clients').select('id,name,metricool_blog_id').eq('status','active').order('name'),
      db.from('content_ideas').select('client_id').gte('publish_date',start).lte('publish_date',end).neq('status','descartada').limit(5000),
    ])
    if (clients.error) throw clients.error
    if (ideas.error) throw ideas.error
    if (ideas.data?.length === 5000) throw new Error('El rango excede el límite de consulta; no se puede emitir un resumen completo')
    const config = getServerConfig()
    if (!config) return {error:'Metricool no está configurado en este servidor'}
    const rows: PublicationAuditRow[] = []
    const deadline = Date.now() + 40_000
    // Bounded concurrency protects the upstream and keeps partial failures explicit.
    const list = clients.data ?? []
    for (let i = 0; i < list.length; i += 8) {
      rows.push(...await Promise.all(list.slice(i,i+8).map(async client => {
        const base = {id:client.id,name:client.name,planned:(ideas.data??[]).filter(v=>v.client_id===client.id).length,drafts:0,scheduled:0,failed:0,manual:0,published:0}
        if (Date.now() > deadline) return {...base,error:'Tiempo de verificación agotado; vuelve a consultar'}
        if (!client.metricool_blog_id?.trim()) return {...base,error:'Falta conectar Metricool'}
        try {
          const posts = await getScheduledPosts({...config,blogId:client.metricool_blog_id},`${start}T00:00:00`,`${end}T23:59:59`)
          return {...base,...summarizePublicationWindow(posts,start,end)}
        } catch {
          return {...base,error:'No se pudo consultar Metricool; estado sin verificar'}
        }
      })))
    }
    return {report:{start,end,checkedAt:new Date().toISOString(),rows}}
  } catch (e) {
    return {error:e instanceof Error?e.message:'No se pudo verificar el flujo'}
  }
}
