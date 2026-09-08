'use server'
import { requirePermission } from '@/lib/auth/server'
import { createClient } from '@/lib/supabase/server'
import { getServerConfig } from '@/lib/metricool/post'
import { getScheduledPosts } from '@/lib/metricool/scheduler'
import { todayISOInTimeZone,addDaysISO } from '@/lib/utils/deadlines'
import {buildCoverage,type OperationalPublicationReport,type ClientCoverage} from '@/lib/utils/operational-publications'
export async function auditOperationalPublications():Promise<{report?:OperationalPublicationReport;error?:string}> {
 try {
  await requirePermission('operations.overview')
  await requirePermission('metricool.read')
  const db=await createClient(),today=todayISOInTimeZone('America/Puerto_Rico'),start=addDaysISO(today,-7),end=addDaysISO(today,14)
  const [clients,ideas]=await Promise.all([
   db.from('clients').select('id,name,posting_days,metricool_blog_id',{count:'exact'}).eq('status','active').order('name').limit(5000),
   db.from('content_ideas').select('id,title,client_id,publish_date,metricool_post_id',{count:'exact'}).gte('publish_date',start).lte('publish_date',end).neq('status','descartada').limit(5000),
  ])
  if(clients.error||ideas.error) return {error:'No se pudo cargar la planificación completa.'}
  if([clients,ideas].some(r=>(r.count??0)>(r.data?.length??0)))return {error:'La consulta quedó incompleta. No se pueden confirmar los totales.'}
  const config=getServerConfig();if(!config)return {error:'Metricool no está configurado.'}
  const result:ClientCoverage[]=[]
  for(let i=0;i<(clients.data??[]).length;i+=8){
   result.push(...await Promise.all((clients.data??[]).slice(i,i+8).map(async c=>{
    const planned=(ideas.data??[]).filter(v=>v.client_id===c.id)
    const base={id:c.id,name:c.name,...buildCoverage([],c.posting_days??[],planned,today,start,end)}
    if(!c.metricool_blog_id)return {...base,error:'Falta Conectar Metricool'}
    try {const posts=await getScheduledPosts({...config,blogId:c.metricool_blog_id},start+'T00:00:00',end+'T23:59:59');return {id:c.id,name:c.name,...buildCoverage(posts,c.posting_days??[],planned,today,start,end)}}
    catch {return {...base,error:'Metricool Sin Verificar'}}
   })))
  }
  return {report:{today,start,end,checkedAt:new Date().toISOString(),clients:result}}
 } catch {return {error:'No se pudo verificar la publicación. Intenta de nuevo.'}}
}
