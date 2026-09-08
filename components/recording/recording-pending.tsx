'use client'
import {RecordingEditors} from './recording-editors'
import {Dialog,DialogContent,DialogHeader,DialogTitle} from '@/components/ui/dialog'
import {useAuth} from '@/lib/context/auth-context'
import {clientDisplayName} from '@/lib/utils/client-display-name'
import {useEffect,useState} from 'react'
import {usePathname} from 'next/navigation'
import {getRecordingPendingTasks} from '@/lib/actions/recording-pending'
export function RecordingPending({badge=false,collapsed=false,onSelect}:{badge?:boolean;collapsed?:boolean;onSelect?:(id:string)=>void}){
 const pathname=usePathname()
 const {role}=useAuth()
 const [editingSession,setEditingSession]=useState<string|null>(null)
 const [result,setResult]=useState<Awaited<ReturnType<typeof getRecordingPendingTasks>>|null>(null)
 const [retry,setRetry]=useState(0)
 useEffect(()=>{
  let active=true,sequence=0
  async function load(){const request=++sequence;try{const next=await getRecordingPendingTasks();if(active&&request===sequence)setResult(next)}catch{if(active&&request===sequence)setResult({tasks:[],month:'',error:'No Se Pudieron Verificar Los Pendientes De Grabación'})}}
  void load()
  const timer=setInterval(()=>{if(document.visibilityState==='visible')void load()},30000)
  window.addEventListener('focus',load);window.addEventListener('recording-preparation-changed',load)
  return()=>{active=false;clearInterval(timer);window.removeEventListener('focus',load);window.removeEventListener('recording-preparation-changed',load)}
 },[pathname,retry])
 if(badge){
  if(!result)return <span className="ml-auto text-xs" title="Consultando Pendientes">…</span>
  if(result.error)return <span className="ml-auto text-orange-500" title={result.error}>!</span>
  if(!result.tasks.length)return null
  return <span aria-label={`${result.tasks.length} Grabaciones Con Tareas Pendientes Este Mes`} title={`${result.tasks.length} Grabaciones Con Tareas Pendientes Este Mes`} className={collapsed?'absolute right-1 top-1 h-2 w-2 rounded-full bg-orange-500':'ml-auto min-w-[18px] rounded-full bg-orange-500 px-1.5 py-0.5 text-center text-[10px] font-bold leading-none text-white'}>{collapsed?null:result.tasks.length>99?'99+':result.tasks.length}</span>
 }
 return <><details id="recording-pending" className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-4" open={!!result?.error}>
  <summary className="cursor-pointer text-sm font-semibold">Tareas Pendientes · Este Mes {result&&!result.error?`(${result.tasks.length})`:''}</summary>
  <p className="mt-2 text-xs text-muted-foreground">Grabaciones de este mes con ideas o asignaciones incompletas. Cada grabación cuenta una vez.</p>
  {!result&&<p className="mt-3 text-sm">Consultando Pendientes…</p>}
  {result?.error?<div role="alert" className="mt-3 text-sm">{result.error} <button className="underline" onClick={()=>setRetry(n=>n+1)}>Reintentar</button></div>:result&&<div className="mt-3 max-h-80 space-y-2 overflow-y-auto">
   {!result.tasks.length&&<p className="text-sm text-emerald-600">No Hay Grabaciones Con Preparación Pendiente Este Mes.</p>}
   {result.tasks.map(task=><div key={task.id} className="rounded-lg border bg-background"><button onClick={()=>onSelect?.(task.id)} className="block w-full rounded-lg border bg-background p-3 text-left hover:bg-accent">
    <span className="flex flex-wrap justify-between gap-2 text-sm"><strong>{clientDisplayName(task.title)}</strong><span className="text-muted-foreground">{task.date.slice(8)}/{task.date.slice(5,7)}</span></span>
    <span className="mt-2 flex flex-wrap gap-2">{task.reasons.map(reason=><span key={reason} className="rounded bg-orange-500/10 px-2 py-1 text-xs text-orange-700 dark:text-orange-300">{reason}</span>)}</span>
   </button>{['owner','supervisor'].includes(role||'')&&<button className="m-3 mt-0 rounded-lg border border-violet-500/30 px-3 py-2 text-xs text-violet-600 dark:text-violet-300" onClick={()=>setEditingSession(task.id)}>Vincular Editores</button>}</div>)}
  </div>}
 </details><Dialog open={!!editingSession} onOpenChange={open=>{if(!open)setEditingSession(null)}}><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>Vincular Editores Al Cliente</DialogTitle></DialogHeader>{editingSession&&<RecordingEditors sessionId={editingSession} onSaved={()=>{setEditingSession(null);setRetry(n=>n+1);window.dispatchEvent(new Event('recording-preparation-changed'))}}/>}</DialogContent></Dialog></>
}
