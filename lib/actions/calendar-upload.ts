'use server'

import { randomUUID } from 'node:crypto'
import { PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { revalidatePath } from 'next/cache'
import { requirePermission } from '@/lib/auth/server'
import { createClient } from '@/lib/supabase/server'
import { entregasR2Client, entregasR2Bucket, isEntregasR2Configured, entregasR2PublicUrl } from '@/lib/integrations/entregas-r2'
import { createDraftPost, getServerConfig } from '@/lib/metricool/post'
import { getScheduledPost } from '@/lib/metricool/scheduler'
import { logIdeaActivity } from '@/lib/utils/idea-activity'
import { resolvePlatforms } from '@/lib/utils/idea-posting-core'
import { calendarUploadType, validateCalendarUpload, type CalendarUploadInput } from '@/lib/published/calendar-upload'

type Result = { ok?: true; ideaId?: string; postId?: number; uuid?: string; confirmed?: boolean; error?: string; uncertain?: boolean; warning?: string; dateTime?: string; clientId?: string }
async function authorize() {
 await requirePermission('posting.calendar.upload')
 await requirePermission('video.upload')
 await requirePermission('metricool.draft')
 const db=await createClient()
 const {data:{user}}=await db.auth.getUser()
 if(!user)throw Error('No autorizado')
 return {db,user}
}
async function ownedIdea(ideaId:string) {
 const {db,user}=await authorize()
 const {data:idea,error}=await db.from('content_ideas').select('*').eq('id',ideaId).maybeSingle()
 if(error||!idea||idea.created_by!==user.id||idea.theme!=='calendar-upload')throw Error('No se pudo verificar esta subida del calendario.')
 const {data:client,error:clientError}=await db.from('clients').select('id,name,status,metricool_blog_id,platforms,default_platforms').eq('id',idea.client_id).eq('status','active').maybeSingle()
 if(clientError||!client?.metricool_blog_id)throw Error('Conecta este cliente con Metricool antes de subir contenido.')
 return {db,user,idea,client}
}
/** Stable idea UUID is the durable transaction identity; retries never create another idea. */
export async function prepareCalendarUpload(input: CalendarUploadInput & {ideaId:string;clientId:string}):Promise<Result> {
 try {
  const {db,user}=await authorize()
  const invalid=validateCalendarUpload(input)
  if(invalid)return {error:invalid}
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.ideaId))return {error:'Identificador de subida inválido.'}
  if(!getServerConfig()||!isEntregasR2Configured()||!entregasR2PublicUrl('calendar-check'))return {error:'La conexión de publicación y subida no está disponible.'}
  const {data:client,error}=await db.from('clients').select('id,name,status,metricool_blog_id,platforms,default_platforms').eq('id',input.clientId).eq('status','active').maybeSingle()
  if(error||!client?.metricool_blog_id)return {error:'Conecta este cliente con Metricool antes de subir contenido.'}
  const allowed=resolvePlatforms(client.platforms,client.default_platforms)
  if(input.platforms.some(p=>!allowed.includes(p)))return {error:'Selecciona solo redes configuradas para este cliente.'}
  const {data:existing,error:readError}=await db.from('content_ideas').select('*').eq('id',input.ideaId).maybeSingle()
  if(readError)return {error:'No se pudo comprobar esta subida.'}
  if(existing) {
   if(existing.created_by!==user.id||existing.client_id!==input.clientId||existing.theme!=='calendar-upload'||existing.generated_caption!==input.caption.trim()||existing.title!==input.title.trim())return {error:'Esta subida ya existe con otro contenido. Verifícala antes de continuar.'}
  } else {
   const {error:insertError}=await db.from('content_ideas').insert({id:input.ideaId,client_id:input.clientId,title:input.title.trim(),generated_caption:input.caption.trim(),content_type:calendarUploadType(input.mimeType),theme:'calendar-upload',created_by:user.id,publish_date:input.dateTime.slice(0,10)})
   if(insertError)return {error:'No se pudo preparar el contenido para este calendario.'}
  }
  const {data:prepared,error:activityReadError}=await db.from('content_idea_activity').select('metadata').eq('content_idea_id',input.ideaId).eq('action','caption_saved').contains('metadata',{source:'calendar_upload',stage:'prepared'}).order('created_at',{ascending:false}).limit(1).maybeSingle()
  if(activityReadError)return {error:'No se pudo comprobar la preparación del contenido.'}
  if(prepared) {
   const metadata=prepared.metadata as Record<string,unknown>
   if(metadata.dateTime!==input.dateTime||metadata.fileName!==input.fileName||metadata.mimeType!==input.mimeType||metadata.sizeBytes!==input.sizeBytes||JSON.stringify(metadata.platforms)!==JSON.stringify([...new Set(input.platforms)]))return {error:'Los detalles de esta subida cambiaron. Revisa el borrador existente antes de continuar.'}
  }
  if(!prepared) {
   const {error:activityError}=await db.from('content_idea_activity').insert({content_idea_id:input.ideaId,client_id:input.clientId,user_id:user.id,action:'caption_saved',metadata:{source:'calendar_upload',stage:'prepared',dateTime:input.dateTime,platforms:[...new Set(input.platforms)],fileName:input.fileName,mimeType:input.mimeType,sizeBytes:input.sizeBytes}})
   if(activityError)return {error:'No se pudo guardar la preparación del contenido.'}
  }
  return {ok:true,ideaId:input.ideaId}
 } catch {return {error:'No se pudo preparar la subida. Comprueba tu acceso y la conexión.'}}
}
/** Raster images use the same delivery bucket; video uses its existing multipart engine. */
export async function getCalendarImageUploadUrl(input:{ideaId:string;fileName:string;contentType:string}):Promise<{url?:string;key?:string;error?:string}> {
 try {
  if(!['image/jpeg','image/png'].includes(input.contentType))return {error:'Solo se aceptan imágenes JPG o PNG.'}
  await ownedIdea(input.ideaId)
  const storage=entregasR2Client()
  if(!storage)return {error:'La subida de archivos no está disponible.'}
  const key=`entregas/${input.ideaId}/edited/${randomUUID()}.${input.contentType==='image/png'?'png':'jpg'}`
  const url=await getSignedUrl(storage,new PutObjectCommand({Bucket:entregasR2Bucket(),Key:key,ContentType:input.contentType}),{expiresIn:3600})
  return {url,key}
 }catch{return {error:'No se pudo preparar la subida de la imagen.'}}
}
export async function finishCalendarUpload(input:{ideaId:string;key:string;fileName:string}):Promise<Result> {
 try {
  const {db,user,idea,client}=await ownedIdea(input.ideaId)
  if(idea.metricool_post_id)return {ok:true,postId:idea.metricool_post_id,uuid:idea.metricool_uuid??undefined,confirmed:false,dateTime:undefined,clientId:idea.client_id,warning:'Este contenido ya se envió. Verifica su estado en el calendario.'}
  if(!input.key.startsWith(`entregas/${idea.id}/edited/`)||input.key.includes('..')||typeof input.fileName!=='string'||!input.fileName.trim()||input.fileName.length>255)return {error:'El archivo no pertenece a esta subida.'}
  const {data:prepared,error:preparedError}=await db.from('content_idea_activity').select('metadata').eq('content_idea_id',idea.id).eq('action','caption_saved').contains('metadata',{source:'calendar_upload',stage:'prepared'}).order('created_at',{ascending:false}).limit(1).maybeSingle()
  const metadata=prepared?.metadata as Record<string,unknown>|undefined
  if(preparedError||!metadata)return {error:'Falta comprobar la preparación de la subida.'}
  const dateTime=metadata.dateTime as string,platforms=metadata.platforms as string[]
  const storage=entregasR2Client()
  if(!storage)return {error:'La subida de archivos no está disponible.'}
  const head=await storage.send(new HeadObjectCommand({Bucket:entregasR2Bucket(),Key:input.key}))
  const invalid=validateCalendarUpload({title:idea.title,caption:idea.generated_caption??'',fileName:input.fileName,mimeType:head.ContentType??'',sizeBytes:head.ContentLength??0,dateTime,platforms})
  if(invalid)return {error:invalid}
  if(head.ContentType!==metadata.mimeType||head.ContentLength!==metadata.sizeBytes||input.fileName!==metadata.fileName)return {error:'El archivo guardado no coincide con la subida preparada.'}
  if(platforms.some(p=>!resolvePlatforms(client.platforms,client.default_platforms).includes(p)))return {error:'Las redes del cliente cambiaron. Verifica el contenido antes de enviarlo.'}
  const mediaUrl=entregasR2PublicUrl(input.key)
  if(!mediaUrl)return {error:'El archivo no tiene una URL de publicación disponible.'}
  // Atomic claim BEFORE registering media or POSTing. Never take over an uncertain claim.
  const {data:claimed,error:claimError}=await db.from('content_ideas').update({posting_started_at:new Date().toISOString()}).eq('id',idea.id).eq('created_by',user.id).is('metricool_post_id',null).is('metricool_uuid',null).is('posting_started_at',null).eq('generated_caption',idea.generated_caption).select('id')
  if(claimError||!claimed?.length)return {error:'Esta subida tiene un envío en curso o pendiente de verificar. Comprueba Metricool antes de repetir.',uncertain:true}
  let accepted=false
  try {
   const {data:existingFile,error:fileReadError}=await db.from('content_idea_videos').select('id').eq('idea_id',idea.id).eq('drive_file_id',input.key).eq('storage_provider','entregas-r2').maybeSingle()
   if(fileReadError)throw Error('No se pudo comprobar el archivo guardado.')
   if(!existingFile) {
    const {error:fileError}=await db.from('content_idea_videos').insert({idea_id:idea.id,kind:'edited',name:input.fileName,drive_file_id:input.key,storage_provider:'entregas-r2',size_bytes:head.ContentLength,mime_type:head.ContentType,uploaded_by:user.id,status:'uploaded'})
    if(fileError)throw Error('No se pudo registrar el archivo subido.')
   }
   let result
   try {result=await createDraftPost(idea.generated_caption!,client.metricool_blog_id!,platforms,undefined,dateTime,{mediaUrls:[mediaUrl],autoPublish:false,contentType:calendarUploadType(head.ContentType!)})}
   catch(error) {
    if(error instanceof Error&&'definitelyNotCreated' in error) {await db.from('content_ideas').update({posting_started_at:null,posting_error:'Metricool rechazó el borrador.'}).eq('id',idea.id);return {error:'Metricool rechazó el borrador. Revisa el archivo y las redes antes de intentar nuevamente.'}}
    accepted=true;throw error
   }
   accepted=true
   const postId=result.data?.id,uuid=result.data?.uuid
   if(!Number.isSafeInteger(postId)||!uuid)throw Error('No se pudo identificar el borrador creado.')
   const {error:recordError}=await db.from('content_ideas').update({metricool_post_id:postId,metricool_uuid:uuid,posting_error:null}).eq('id',idea.id)
   if(recordError)return {error:'Metricool aceptó el borrador, pero el dashboard no pudo guardar su referencia. Verifica antes de volver a enviar.',uncertain:true,postId,uuid}
   let confirmed=false
   const config=getServerConfig()
   try {
    if(config) {
     const current=await getScheduledPost({...config,blogId:client.metricool_blog_id!},postId!)
     const media=(current.media as (string|{url?:string})[]|undefined)??[]
     confirmed=current.uuid===uuid&&current.draft===true&&current.autoPublish!==true&&current.text===idea.generated_caption&&current.publicationDate.dateTime===`${dateTime}:00`&&current.publicationDate.timezone==='America/Puerto_Rico'&&JSON.stringify(current.providers.map(p=>p.network).sort())===JSON.stringify([...platforms].sort())&&media.some(m=>(typeof m==='string'?m:m.url)===mediaUrl)
    }
   }catch{/* Accepted creation is never replayed if read-back fails. */}
   await logIdeaActivity(db,{ideaId:idea.id,clientId:idea.client_id,userId:user.id,action:'posted_to_metricool',metadata:{source:'calendar_upload',draft:true,autoPublish:false,metricoolPostId:postId,platforms,scheduledFor:dateTime,publicUrl:mediaUrl}})
   for(const path of ['/home','/published','/recibo','/pool',`/clients/${idea.client_id}`,`/clients/${idea.client_id}/calendar`])revalidatePath(path)
   return {ok:true,postId,uuid,confirmed,dateTime,clientId:idea.client_id,...(!confirmed?{warning:'Metricool aceptó el borrador; verifica el calendario para confirmar su contenido.'}:{})}
  }catch {
   if(!accepted)await db.from('content_ideas').update({posting_started_at:null,posting_error:'No se pudo registrar el archivo.'}).eq('id',idea.id)
   else await db.from('content_ideas').update({posting_error:'Envío pendiente de verificar en Metricool.'}).eq('id',idea.id)
   return {error:accepted?'No se pudo confirmar el envío. Verifica Metricool antes de repetir.':'El archivo está subido, pero no se pudo registrarlo. Intenta guardar el borrador nuevamente.',uncertain:accepted}
  }
 }catch{return {error:'No se pudo comprobar la subida. Verifica el cliente, archivo y conexión.'}}
}
