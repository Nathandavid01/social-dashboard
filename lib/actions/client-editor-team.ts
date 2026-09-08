'use server'
import {getEffectiveRole} from '@/lib/auth/server'
import {createClient} from '@/lib/supabase/server'
import {revalidatePath} from 'next/cache'
export async function saveClientEditorTeam(clientId:string,editorIds:string[]):Promise<{ok?:true;error?:string}>{
 if(!['owner','supervisor'].includes((await getEffectiveRole())||''))return {error:'No Autorizado Para Asignar Clientes'}
 const db=await createClient()
 const {data,error}=await db.rpc('set_client_editors',{p_client_id:clientId,p_editor_ids:[...new Set(editorIds)]})
 if(error||!data?.ok)return {error:error?.code==='PGRST202'?'Falta Aplicar La Migración 0079 Para Guardar Desde Clientes.':error?.message||'No Se Pudo Confirmar La Asignación'}
 for(const path of ['/clients/asignaciones','/clients','/account/profile','/pipeline','/recording-calendar','/onsite','/mi-dia'])revalidatePath(path)
 revalidatePath('/team/[memberId]','page')
 return {ok:true}
}
