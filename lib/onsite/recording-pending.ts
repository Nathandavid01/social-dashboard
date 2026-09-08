import { requiredForOnsite } from './slot-count'
export interface PendingSessionSource {
 id:string; title:string; session_date:string; status:string; client_id:string|null; videographer_id:string|null
 client:{name:string;assigned_to:string|null;posting_days:number[]|null}|null
}
export interface PendingIdeaSource {id:string;client_id:string|null;recording_session_id:string|null;status:string;title:string|null}
export interface RecordingPendingTask {id:string;title:string;date:string;reasons:string[]}
export function recordingPendingTasks(sessions:PendingSessionSource[],ideas:PendingIdeaSource[],month:string):RecordingPendingTask[]{
 return sessions.filter(s=>s.session_date.startsWith(month+'-')&&!['completed','cancelled'].includes(s.status)).flatMap(s=>{
  const reasons:string[]=[]
  if(!s.client_id||!s.client) reasons.push('Vincular Cliente')
  if(!s.videographer_id) reasons.push('Asignar Videógrafo')
  if(s.client&&!s.client.assigned_to) reasons.push('Asignar Editor')
  const target=requiredForOnsite({postingDays:s.client?.posting_days,ref:new Date(s.session_date+'T12:00:00')}).slotTarget
  const count=new Set(ideas.filter(i=>i.recording_session_id===s.id&&i.client_id===s.client_id&&i.status!=='descartada'&&i.title?.trim()).map(i=>i.id)).size
  if(!target) reasons.push('Definir Meta De Ideas')
  else if(count<target) reasons.push(`Faltan ${target-count} Ideas (${count}/${target})`)
  return reasons.length?[{id:s.id,title:s.client?.name||s.title,date:s.session_date,reasons}]:[]
 }).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id))
}
