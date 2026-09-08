'use server'
import { currentUserHas } from '@/lib/auth/server'
import { createClient } from '@/lib/supabase/server'
import { todayISOInTimeZone } from '@/lib/utils/deadlines'
import { readCompletePages } from '@/lib/utils/read-complete-pages'
import { recordingPendingTasks,type PendingSessionSource,type PendingIdeaSource,type RecordingPendingTask } from '@/lib/onsite/recording-pending'
export async function getRecordingPendingTasks():Promise<{tasks:RecordingPendingTask[];month:string;error?:string}>{
 const month=todayISOInTimeZone('America/Puerto_Rico').slice(0,7)
 if(!await currentUserHas('recording.read')) return {tasks:[],month,error:'Sin Acceso A Grabaciones'}
 try{
  const db=await createClient()
  const [year,m]=month.split('-').map(Number)
  const end=`${m===12?year+1:year}-${String(m===12?1:m+1).padStart(2,'0')}-01`
  const rows=await readCompletePages<PendingSessionSource>((from,to)=>db.from('recording_sessions').select('id,title,session_date,status,client_id,videographer_id,client:clients!recording_sessions_client_id_fkey(name,assigned_to,posting_days)',{count:'exact'}).gte('session_date',month+'-01').lt('session_date',end).not('status','in','(completed,cancelled)').order('id').range(from,to) as unknown as PromiseLike<{data:PendingSessionSource[]|null;count:number|null;error?:unknown}>)
  const ideas:PendingIdeaSource[]=[]
  for(let n=0;n<rows.length;n+=100){
   ideas.push(...await readCompletePages<PendingIdeaSource>((from,to)=>db.from('content_ideas').select('id,title,status,client_id,recording_session_id',{count:'exact'}).in('recording_session_id',rows.slice(n,n+100).map(s=>s.id)).order('id').range(from,to)))
  }
  return {tasks:recordingPendingTasks(rows,ideas,month),month}
 }catch{return {tasks:[],month,error:'No Se Pudieron Verificar Los Pendientes De Grabación'}}
}
