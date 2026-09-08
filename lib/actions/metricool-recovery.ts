'use server'
import { requirePermission } from '@/lib/auth/server'
import { createClient } from '@/lib/supabase/server'
import { getServerConfig } from '@/lib/metricool/post'
import { getScheduledPosts } from '@/lib/metricool/scheduler'
import { verifyRecoveryPost } from '@/lib/metricool/recovery'
import { resolvePlatforms } from '@/lib/utils/idea-posting-core'
import { entregasR2PublicUrl } from '@/lib/integrations/entregas-r2'
import { r2PublicUrl } from '@/lib/integrations/r2'
import { revalidatePath } from 'next/cache'

export async function recoverMetricoolPost(ideaId: string, postId: number): Promise<{ok?:true;error?:string}> {
  try {
    await requirePermission('posting.publish')
    if (!Number.isSafeInteger(postId) || postId <= 0) return {error:'Indica un ID de publicación válido.'}
    const db=await createClient()
    const {data:idea,error}=await db.from('content_ideas').select('id, client_id, generated_caption, approved_video_id, posting_started_at, publish_date, metricool_post_id, client:clients(metricool_blog_id, platforms, default_platforms)').eq('id',ideaId).maybeSingle()
    if(error) return {error:error.message}
    if(!idea?.posting_started_at || idea.metricool_post_id) return {error:'La idea no tiene un envío pendiente de recuperar.'}
    if(Date.now()-new Date(idea.posting_started_at).getTime()<60_000) return {error:'El envío todavía puede estar en curso. Espera un minuto y actualiza.'}
    const client=idea.client as unknown as {metricool_blog_id?:string;platforms?:string[];default_platforms?:string[]}|null
    const config=getServerConfig()
    if(!config || !client?.metricool_blog_id?.trim()) return {error:'Falta la configuración de Metricool del cliente.'}
    const {data:video,error:videoError}=await db.from('content_idea_videos').select('id, kind, status, storage_provider, drive_file_id').eq('id',idea.approved_video_id ?? '').eq('idea_id',ideaId).maybeSingle()
    if(videoError || !video || video.kind!=='edited' || video.status==='archived') return {error:'No se pudo verificar el video aprobado.'}
    const mediaUrl=video.storage_provider==='entregas-r2'?entregasR2PublicUrl(video.drive_file_id):video.storage_provider==='r2'?r2PublicUrl(video.drive_file_id):null
    if(!mediaUrl) return {error:'No se pudo verificar la URL del video aprobado.'}
    const anchor=new Date(`${idea.publish_date ?? new Date().toISOString().slice(0,10)}T12:00:00Z`)
    if(!Number.isFinite(anchor.getTime())) return {error:'La fecha de publicación no es válida.'}
    const start=new Date(anchor.getTime()-365*86400000).toISOString().slice(0,19)
    const end=new Date(anchor.getTime()+365*86400000).toISOString().slice(0,19)
    const posts=await getScheduledPosts({...config,blogId:client.metricool_blog_id.trim()},start,end)
    const matches=posts.filter(post=>post.id===postId)
    if(matches.length!==1) return {error:'No se encontró un único post con ese ID en el cliente. El envío sigue bloqueado.'}
    const post=matches[0]
    const mismatch=verifyRecoveryPost(post,{postId,caption:idea.generated_caption ?? '',mediaUrl,platforms:resolvePlatforms(client.platforms,client.default_platforms)})
    if(mismatch) return {error:mismatch}
    const {data:saved,error:saveError}=await db.from('content_ideas').update({metricool_post_id:post.id,metricool_uuid:post.uuid ?? null,posted_at:new Date().toISOString(),posting_error:null})
      .eq('id',ideaId).eq('client_id',idea.client_id).eq('posting_started_at',idea.posting_started_at).eq('approved_video_id',idea.approved_video_id!).eq('generated_caption',idea.generated_caption!).is('metricool_post_id',null).select('id').maybeSingle()
    if(saveError || !saved) return {error:saveError?.message ?? 'La idea cambió durante la verificación. Actualiza y vuelve a comprobar.'}
    for(const path of ['/settings/metricool','/mi-dia','/entregas','/pipeline','/published']) revalidatePath(path)
    return {ok:true}
  } catch(err) {return {error:err instanceof Error?err.message:'No se pudo verificar el post en Metricool.'}}
}
