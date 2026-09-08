'use server'
import {revalidatePath} from 'next/cache'
import {createClient} from '@/lib/supabase/server'
import {getEffectiveRole,getEffectiveUserId} from '@/lib/auth/server'
import {readCompletePages} from '@/lib/utils/read-complete-pages'
export interface EditorSetup {clientId:string|null;clients:{id:string;name:string;assigned_to:string|null}[];editors:{id:string;full_name:string|null}[];links:{client_id:string;editor_id:string}[];error?:string}
export async function getRecordingEditorSetup(sessionId?:string):Promise<EditorSetup>{
 const empty:EditorSetup={clientId:null,clients:[],editors:[],links:[]}
 if(!['owner','supervisor'].includes((await getEffectiveRole())||''))return {...empty,error:'Solo Administradores Y Supervisores Pueden Vincular Editores'}
 try{
  const db=await createClient()
  const session=sessionId?await db.from('recording_sessions').select('client_id').eq('id',sessionId).single():{data:{client_id:null},error:null}
  if(session.error||!session.data)throw new Error('Sesión No Disponible')
  const clients=await readCompletePages<{id:string;name:string;assigned_to:string|null}>((from,to)=>db.from('clients').select('id,name,assigned_to',{count:'exact'}).eq('status','active').order('id').range(from,to))
  const editors=await readCompletePages<{id:string;full_name:string|null}>((from,to)=>db.from('profiles').select('id,full_name',{count:'exact'}).eq('role','editor').eq('status','active').eq('approval_status','approved').order('id').range(from,to))
  // Composite-key table: page with a stable synthetic identity.
  const links=await readCompletePages<{id:string;client_id:string;editor_id:string}>(async(from,to)=>{
   const r=await db.from('client_editor_assignments').select('client_id,editor_id',{count:'exact'}).order('client_id').order('editor_id').range(from,to)
   return {...r,data:r.data?.map(x=>({...x,id:x.client_id+':'+x.editor_id}))??null}
  })
  return {clientId:session.data.client_id,clients:clients.sort((a,b)=>a.name.localeCompare(b.name)),editors:editors.sort((a,b)=>(a.full_name||'').localeCompare(b.full_name||'')),links}
 }catch{return {...empty,error:'No Se Puede Cargar La Asignación Múltiple. Verifica La Conexión Y Que La Migración 0078 Esté Aplicada.'}}
}
export async function saveRecordingEditors(sessionId:string,clientId:string,editorIds:string[]):Promise<{ok?:true;error?:string}>{
 if(!['owner','supervisor'].includes((await getEffectiveRole())||''))return {error:'No Autorizado Para Asignar Editores'}
 const db=await createClient()
 const {data,error}=await db.rpc('set_recording_client_editors',{p_session_id:sessionId,p_client_id:clientId,p_editor_ids:[...new Set(editorIds)]})
 if(error||!data?.ok)return {error:error?.message||'No Se Pudo Confirmar La Asignación'}
 for(const path of ['/recording-calendar','/onsite','/account/profile','/team','/clients/asignaciones','/pipeline','/mi-dia'])revalidatePath(path)
 return {ok:true}
}
export async function getMyEditorClients(memberId?:string){
 const db=await createClient();const {data:{user}}=await db.auth.getUser()
 if(!user)return {clients:[],error:'Inicia Sesión'}
 const effective=await getEffectiveUserId()||user.id
 if(memberId&&memberId!==effective&&!['owner','supervisor'].includes((await getEffectiveRole())||''))return {clients:[],error:'No Autorizado'}
 const member=memberId||effective
 const primary=await db.from('clients').select('id,name').eq('assigned_to',member).eq('status','active').order('name')
 if(primary.error)return {clients:[],error:'No Se Pudieron Cargar Tus Clientes'}
 const links=await db.from('client_editor_assignments').select('client_id,client:clients!client_editor_assignments_client_id_fkey(id,name,status)').eq('editor_id',member)
 if(links.error)return {clients:primary.data??[],error:'Asignaciones Adicionales Sin Verificar. Requiere La Migración 0078 Y Conexión Disponible.'}
 const clients=new Map((primary.data??[]).map(c=>[c.id,c]))
 for(const link of links.data??[]){const raw=link.client;const c=Array.isArray(raw)?raw[0]:raw;if(c&&c.status==='active')clients.set(c.id,{id:c.id,name:c.name})}
 return {clients:[...clients.values()].sort((a,b)=>a.name.localeCompare(b.name))}
}
