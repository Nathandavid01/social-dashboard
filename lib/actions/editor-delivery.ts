'use server'
import {createClient} from '@/lib/supabase/server'
import {requirePermission,currentUserHas} from '@/lib/auth/server'
import {revalidatePath} from 'next/cache'
import {notifyReviewChange} from '@/lib/utils/review-notification'

async function deliveryContext(ideaId:string){
 await requirePermission('video.upload')
 const db=await createClient()
 const {data:{user}}=await db.auth.getUser()
 const {data:idea,error}=await db.from('content_ideas').select('id,title,status,approval_status,created_by,metricool_post_id,posted_at,published_at,posting_started_at,client:clients(assigned_to),production_task:production_tasks!content_ideas_production_task_id_fkey(assigned_to_id)').eq('id',ideaId).single()
 if(error||!idea||!user)throw Error('No Se Pudo Cargar La Pieza')
 const client=Array.isArray(idea.client)?idea.client[0]:idea.client
 const task=Array.isArray(idea.production_task)?idea.production_task[0]:idea.production_task
 if((task?.assigned_to_id??client?.assigned_to??idea.created_by)!==user.id&&!await currentUserHas('video.approve'))throw Error('Solo El Editor Asignado Puede Entregar Esta Pieza')
 if(idea.approval_status!=='pending'||['publicada','descartada'].includes(idea.status)||idea.metricool_post_id!=null||idea.posted_at||idea.published_at||idea.posting_started_at)throw Error('La Pieza Ya Está En Revisión, Cerrada O Agendada. Actualiza El Tablero.')
 return {db,user,idea}
}
export async function checkEditorDelivery(ideaId:string){
 try{await deliveryContext(ideaId);return {ok:true as const}}catch(e){return {error:e instanceof Error?e.message:'No Se Pudo Verificar La Asignación'}}
}
export async function submitEditorDelivery(ideaId:string,videoId:string){
 try{
 const {db,user,idea}=await deliveryContext(ideaId)
 const {data:file,error}=await db.from('content_idea_videos').select('id,uploaded_by,drive_file_id').eq('id',videoId).eq('idea_id',ideaId).eq('kind','edited').eq('storage_provider','entregas-r2').not('status','in','(archived,failed,uploading)').maybeSingle()
 if(error||!file?.drive_file_id||file.uploaded_by!==user.id)return {error:'Sube El Video Editado Antes De Enviar A Revisión'}
 const {data:changed,error:saveError}=await db.from('content_ideas').update({status:'producida',approval_status:'submitted',submitted_at:new Date().toISOString(),approved_video_id:null,approved_at:null,approved_by:null}).eq('id',ideaId).eq('approval_status','pending').eq('status',idea.status).is('metricool_post_id',null).is('posted_at',null).is('published_at',null).is('posting_started_at',null).select('id').maybeSingle()
 if(saveError||!changed)return {error:'No Se Pudo Confirmar El Envío. Actualiza Antes De Reintentar.'}
 for(const path of ['/pipeline','/revision','/mi-dia','/home','/entregas','/banco'])revalidatePath(path)
 const warning=await notifyReviewChange(db,{ideaId,title:idea.title||'Video',actorId:user.id,outcome:'submitted'})
 return {ok:true as const,...(warning?{warning}:{})}
 }catch(e){return {error:e instanceof Error?e.message:'No Se Pudo Enviar A Revisión'}}
}
