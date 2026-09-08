'use client'
import {useRouter} from 'next/navigation'
import {RecordingEditors} from '@/components/recording/recording-editors'
export function ClientEditorTeam(){
 const router=useRouter()
 return <section className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-4 sm:p-5"><h1 className="text-lg font-semibold">Editores Por Cliente</h1><p className="mb-4 mt-1 text-sm text-muted-foreground">Asigna aquí uno o varios editores a cada cliente. Sus perfiles mostrarán los clientes vinculados. El rol y los permisos se administran en Usuarios.</p><RecordingEditors onSaved={()=>{router.refresh()}}/></section>
}
