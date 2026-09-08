import 'server-only'
import type {SupabaseClient} from '@supabase/supabase-js'

export async function notifyReviewChange(db:SupabaseClient,input:{ideaId:string;title:string;editorId?:string|null;actorId?:string|null;outcome:'approved'|'revision_needed'|'submitted';note?:string}):Promise<string|undefined>{
  try{
    let recipients=input.editorId?[input.editorId]:[]
    if(input.outcome==='submitted'){
      const {data,error}=await db.from('profiles').select('id').in('role',['owner','supervisor']).eq('status','active')
      if(error)throw error
      recipients=(data??[]).map(p=>p.id)
    }
    recipients=[...new Set(recipients)].filter(id=>id!==input.actorId)
    if(!recipients.length)return
    const correction=input.outcome==='revision_needed',submitted=input.outcome==='submitted'
    const {error}=await db.from('notifications').insert(recipients.map(user_id=>({
      user_id,kind:correction?'review_rejected':submitted?'review_pending':'review_approved',
      title:correction?'Corrección Pendiente':submitted?'Video Listo Para Revisión':'Video Aprobado',
      body:correction?`${input.title}: ${input.note?.trim()}`:submitted?`${input.title}: revisa la nueva versión y sus captions.`:`${input.title}: revisión aprobada. Pendiente de agendar en Metricool.`,
      link:submitted?'/revision':'/mi-dia',severity:correction?'warning':submitted?'info':'success',
      meta:{ideaId:input.ideaId,approvalStatus:input.outcome},
    })))
    if(error)throw error
  }catch(error){console.error('[review-notification]',error);return 'El cambio se guardó, pero no se pudo entregar el aviso. Consulta Mi Día.'}
}
