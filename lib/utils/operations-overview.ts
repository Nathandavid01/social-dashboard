import type { IdeaWithPipeline } from '@/lib/supabase/types'
import { editorApprovalStats, editorWipLimitFor } from '@/lib/pipeline/editor-wip'
import { editorWipIdeaIds } from '@/lib/pipeline/editor-video-bank'
import { ideaHasEntregasEditedVideo } from './entregas-delivery'
import { resolveVideoForPublish } from './idea-posting-core'
import { automaticPublishSchedule } from './automatic-publish-schedule'

export interface OverviewClient { id:string; name:string; posting_days:number[]|null; metricool_blog_id:string|null; posting_time?:string|null }
export interface OverviewEditor { id:string; full_name:string|null; role:string; status:string }
export interface OverviewItem { id:string; title:string; client:string; owner:string; date:string|null; state:string; href:string; done:boolean; missing?:boolean; checks:{label:string;done:boolean}[] }
export interface OperationsOverview { date:string; today:OverviewItem[]; overdue:OverviewItem[]; reviews:OverviewItem[]; corrections:OverviewItem[]; ready:OverviewItem[]; blocked:OverviewItem[]; uploads:OverviewItem[]; editors:{id:string;name:string;used:number;limit:number;free:number}[] }
export function buildOperationsOverview(ideas:IdeaWithPipeline[], clients:OverviewClient[], profiles:OverviewEditor[], today:string, now=Date.now()):OperationsOverview {
 const activeClients=new Map(clients.map(c=>[c.id,c]))
 const active=ideas.filter(i=>i.status!=='descartada'&&activeClients.has(i.client_id??''))
 const result:OperationsOverview={date:today,today:[],overdue:[],reviews:[],corrections:[],ready:[],blocked:[],uploads:[],editors:[]}
 for(const i of active){
  const c=activeClients.get(i.client_id!)!
  const published=!!i.published_at||i.status==='publicada'
  const sent=!!i.metricool_post_id||!!i.posted_at
  const edited=ideaHasEntregasEditedVideo(i)
  const approved=i.approval_status==='approved'
  const reviewVerified=(i as IdeaWithPipeline & {reviewVerified?:boolean}).reviewVerified===true
  const reviewNote=(i as IdeaWithPipeline & {reviewNote?:string}).reviewNote
  const copy=!!i.generated_caption?.trim()
  const approvedVideoId=(i as IdeaWithPipeline & {approved_video_id?:string|null}).approved_video_id
  const choice=resolveVideoForPublish(i.videos.filter(v=>v.status!=='failed'),{ideaId:i.id,approvedVideoId})
  const sealed=!!choice.video&&!choice.skipped
  const raw=i.videos.some(v=>v.kind==='raw'&&v.status!=='archived'&&v.status!=='failed')
  const schedule=automaticPublishSchedule(i.publish_date,c.posting_time,now)
  const ready=edited&&approved&&reviewVerified&&copy&&sealed&&!!c.metricool_blog_id?.trim()&&schedule.ok&&!sent&&!published
  const needsReview=edited&&i.approval_status==='submitted'&&!published&&!sent
  const correction=edited&&i.approval_status==='revision_needed'&&!published&&!sent
  const state=published?'Publicado':sent?'Enviado · Falta Verificar':!edited?(raw?'Falta Subir Editado':'Falta Subir Crudo'):correction?`Corregir Video${reviewNote?' · '+reviewNote:''}`:!approved?'Revisar Video':!sealed?'Revisar Archivo Aprobado':!reviewVerified?'Verificar Video Y Subtítulos':!copy?'Completar Copy':!c.metricool_blog_id?.trim()?'Conectar Metricool':!schedule.ok?schedule.error:'Listo Para Agendar'
  const item:OverviewItem={id:i.id,title:i.title||'Sin Título',client:c.name,owner:i.assignee?.full_name||'Sin Asignar',date:i.publish_date,state,done:published,href:`/produccion/idea/${i.id}`,checks:[{label:'Crudo',done:raw},{label:'Editado',done:edited},{label:'Video Y Subtítulos',done:reviewVerified},{label:'Aprobado',done:approved},{label:'Copy',done:copy},{label:'Enviado',done:sent||published},{label:'Publicado',done:published}]}
  if(i.publish_date===today){result.today.push(item);if(!edited&&!published&&!sent)result.uploads.push(item)}
  if(i.publish_date&&i.publish_date<today&&!published&&!sent)result.overdue.push(item)
  if(needsReview)result.reviews.push(item)
  if(correction)result.corrections.push(item)
  if(ready)result.ready.push(item)
  else if(edited&&approved&&!sent&&!published)result.blocked.push(item)
 }
 const weekday=new Date(today+'T12:00:00Z').getUTCDay()
 for(const c of clients){
  if(c.posting_days?.includes(weekday)&&!active.some(i=>i.client_id===c.id&&i.publish_date===today)){
   result.today.push({id:'missing-'+c.id,title:'Falta Preparar El Video De Hoy',client:c.name,owner:'Sin Asignar',date:today,state:'Sin Video Fechado',href:`/clients/${c.id}`,done:false,missing:true,checks:[]})
  }
 }
 result.editors=profiles.filter(p=>p.status==='active'&&(p.role==='editor'||p.role==='team_member')).map(p=>{
  const limit=editorWipLimitFor(editorApprovalStats(ideas,p.id))
  const used=editorWipIdeaIds(active,p.id,today,limit).size
  return {id:p.id,name:p.full_name||'Editor',used,limit,free:Math.max(0,limit-used)}
 }).sort((a,b)=>b.free-a.free||a.name.localeCompare(b.name))
 result.today.sort((a,b)=>Number(a.done)-Number(b.done)||a.client.localeCompare(b.client))
 return result
}
