'use server'
import {z} from 'zod'
import {revalidatePath} from 'next/cache'
import {createClient} from '@/lib/supabase/server'
import {currentUserHas,getEffectiveUserId} from '@/lib/auth/server'
import {readCompletePages} from '@/lib/utils/read-complete-pages'
const assignment=z.object({id:z.string().uuid(),title:z.string().trim().min(1).max(200),description:z.string().trim().max(1000),assignee_id:z.string().uuid(),due_at:z.string().datetime({offset:true}),priority:z.number().int().min(1).max(3)})
export interface PersonalTask {id:string;title:string;description:string|null;assignee_id:string|null;due_at:string|null;priority:number;status:string}
export interface TaskPerson {id:string;full_name:string|null}
function refresh(){for(const path of ['/account/profile','/mi-dia','/team','/operations','/home'])revalidatePath(path)}
export async function getPersonalTasks():Promise<{tasks:PersonalTask[];people:TaskPerson[];canAssign:boolean;userId:string;error?:string}>{
 try{
  const db=await createClient();const {data:{user}}=await db.auth.getUser()
  if(!user)return {tasks:[],people:[],canAssign:false,userId:'',error:'Inicia Sesión Para Ver Tus Tareas'}
  const userId=await getEffectiveUserId()||user.id
  const canAssign=await currentUserHas('tasks.create')&&await currentUserHas('tasks.read.all')
  const tasks=await readCompletePages<PersonalTask>((from,to)=>{
   let query=db.from('tasks').select('id,title,description,assignee_id,due_at,priority,status',{count:'exact'}).order('id')
   if(!canAssign)query=query.eq('assignee_id',userId)
   return query.range(from,to)
  })
  const people=canAssign?await readCompletePages<TaskPerson>((from,to)=>db.from('profiles').select('id,full_name',{count:'exact'}).eq('status','active').eq('approval_status','approved').order('id').range(from,to)):[]
  return {tasks,people,canAssign,userId}
 }catch{return {tasks:[],people:[],canAssign:false,userId:'',error:'No Se Pudieron Cargar Las Tareas. Reintenta.'}}
}
export async function assignPersonalTask(input:unknown):Promise<{ok?:true;error?:string;warning?:string;uncertain?:boolean}>{
 if(!await currentUserHas('tasks.create'))return {error:'No Tienes Permiso Para Asignar Tareas'}
 const parsed=assignment.safeParse(input);if(!parsed.success)return {error:'Completa La Persona, Tarea, Instrucciones Y Fecha Válida'}
 const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user)return {error:'Inicia Sesión'}
 const values=parsed.data
 const {data:person,error:personError}=await db.from('profiles').select('id').eq('id',values.assignee_id).eq('status','active').eq('approval_status','approved').single()
 if(personError||!person)return {error:'Selecciona Una Persona Activa Y Aprobada'}
 const {error}=await db.from('tasks').insert({...values,type:'other',status:'pending',created_by:user.id})
 if(error){
  if(error.code==='23505'){
   const {data:existing}=await db.from('tasks').select('id,title,description,assignee_id,due_at,priority,created_by').eq('id',values.id).single()
   if(existing&&existing.created_by===user.id&&existing.title===values.title&&existing.description===values.description&&existing.assignee_id===values.assignee_id&&existing.priority===values.priority&&Date.parse(existing.due_at)===Date.parse(values.due_at)){refresh();return {ok:true}}
  }
  return {error:'No Se Pudo Confirmar La Asignación. Reintenta Sin Cambiar La Solicitud.',uncertain:true}
 }
 let warning:string|undefined
 try{
  const {error:noticeError}=await db.from('notifications').insert({user_id:values.assignee_id,kind:'task_assigned',title:'Nueva Tarea Asignada',body:values.title,link:'/account/profile#tareas',severity:'info',meta:{task_id:values.id}})
  if(noticeError)warning='La Tarea Se Guardó, Pero El Aviso No Se Pudo Enviar.'
 }catch{warning='La Tarea Se Guardó, Pero El Aviso No Se Pudo Confirmar.'}
 refresh();return {ok:true,warning}
}
export async function setPersonalTaskStatus(id:string,status:string):Promise<{ok?:true;error?:string}>{
 if(!z.string().uuid().safeParse(id).success||!['pending','in_progress','blocked','completed'].includes(status))return {error:'Estado No Válido'}
 const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user)return {error:'Inicia Sesión'}
 const userId=await getEffectiveUserId()||user.id
 const manage=await currentUserHas('tasks.edit')&&await currentUserHas('tasks.read.all')
 let query=db.from('tasks').update({status}).eq('id',id)
 if(!manage)query=query.eq('assignee_id',userId)
 const {data,error}=await query.select('id').maybeSingle()
 if(error||!data)return {error:'No Se Pudo Actualizar Esta Tarea'}
 refresh();return {ok:true}
}
