'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getAddableIdeas, addIdeaToSession, type AddableIdea } from '@/lib/actions/onsite'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function SessionIdeaPicker({sessionId,onAdded}:{sessionId:string;onAdded:()=>void}) {
 const [ideas,setIdeas]=useState<AddableIdea[]>([])
 const [search,setSearch]=useState('')
 const [error,setError]=useState('')
 const [loading,setLoading]=useState(true)
 const [saving,setSaving]=useState(false)
 const router=useRouter()
 useEffect(()=>{let active=true;getAddableIdeas(sessionId).then(r=>{if(active){setIdeas(r.ideas??[]);setError(r.error??'');setLoading(false)}}).catch(()=>{if(active){setError('No se pudieron cargar las ideas.');setLoading(false)}});return()=>{active=false}},[sessionId])
 async function add(idea:AddableIdea){
  setSaving(true);setError('')
  try {const result=await addIdeaToSession({sessionId,ideaId:idea.id,source:idea.source});if(result.error){setError(result.error);return}setIdeas(rows=>rows.filter(i=>i.id!==idea.id||i.source!==idea.source));router.refresh();onAdded()}
  catch {setError('No se pudo agregar la idea. Intenta de nuevo.')}
  finally {setSaving(false)}
 }
 const visible=ideas.filter(i=>i.title.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
 return <div className="space-y-3 rounded-lg border border-violet-500/30 bg-violet-500/5 p-3">
  <p className="text-sm font-semibold">Elegir Ideas Existentes</p>
  <p className="text-xs text-muted-foreground">On Site y Escribir Ideas comparten el banco del cliente. Del Lab se muestran las ideas aprobadas.</p>
  <Input placeholder="Buscar Ideas Del Cliente" value={search} onChange={e=>setSearch(e.target.value)}/>
  {error&&<p role="alert" className="text-xs text-destructive">{error}</p>}
  {loading?<p className="text-xs">Cargando Ideas…</p>:<ul className="max-h-64 space-y-2 overflow-y-auto">{visible.map(i=><li key={i.source+i.id} className="flex items-center gap-3 rounded-md border bg-background p-3"><div className="min-w-0 flex-1"><p className="break-words text-sm">{i.title}</p><p className="mt-1 text-xs text-violet-600 dark:text-violet-400">{i.source==='lab'?'Lab De Ideas':'On Site / Escribir Ideas'}</p></div><Button type="button" size="sm" variant="outline" disabled={saving} onClick={()=>add(i)}>Agregar</Button></li>)}</ul>}
  {!loading&&!visible.length&&!error&&<p className="text-xs text-muted-foreground">No hay ideas disponibles para esta búsqueda. Las ideas ligadas a otra sesión se conservan allí.</p>}
 </div>
}
