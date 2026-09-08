'use server'
import { createClient } from '@/lib/supabase/server'
import { currentUserHas } from '@/lib/auth/server'
import { todayISOInTimeZone } from '@/lib/utils/deadlines'
import { buildOperationsOverview, type OperationsOverview } from '@/lib/utils/operations-overview'
import type { IdeaWithPipeline } from '@/lib/supabase/types'

export async function getOperationsOverview():Promise<{data?:OperationsOverview;error?:string}|null>{
 if(!await currentUserHas('operations.overview'))return null
 const db=await createClient()
 const {data:{user}}=await db.auth.getUser()
 if(!user)return null
 const profile=await db.from('profiles').select('status,approval_status').eq('id',user.id).single()
 if(profile.error||!profile.data||profile.data.status==='inactive'||['pending','rejected'].includes(profile.data.approval_status))return null
 const [ideas,clients,editors]=await Promise.all([
  db.from('content_ideas').select('*, client:clients!content_ideas_client_id_fkey(id,name,assigned_to), videos:content_idea_videos!content_idea_videos_idea_id_fkey(*), production_task:production_tasks!content_ideas_production_task_id_fkey(id,status,publish_date,assigned_to:profiles!production_tasks_assigned_to_id_fkey(id,full_name))', { count: 'exact' }).order('id').limit(5000),
  db.from('clients').select('id,name,posting_days,posting_time,metricool_blog_id', { count: 'exact' }).eq('status','active').order('id').limit(5000),
  db.from('profiles').select('id,full_name,role,status', { count: 'exact' }).eq('status','active').order('id').limit(5000),
 ])
 if(ideas.error||clients.error||editors.error)return {error:'No se pudo cargar el resumen del equipo. Vuelve a intentar; los pendientes no se han contado.'}
 if([ideas,clients,editors].some(r=>(r.count??0)>(r.data?.length??0)||(r.data?.length??0)>=5000))return {error:'El volumen supera el límite de consulta. El resumen está sin verificar.'}
 const mapped=(ideas.data??[]).map(i=>({...i,videos:i.videos??[],assignee:i.production_task?.assigned_to??null})) as unknown as IdeaWithPipeline[]
 return {data:buildOperationsOverview(mapped,clients.data??[],editors.data??[],todayISOInTimeZone('America/Puerto_Rico'))}
}
