'use client'
import {useState} from 'react'
import {useRouter} from 'next/navigation'
import {recoverMetricoolPost} from '@/lib/actions/metricool-recovery'

export function RecoveryPanel({rows,error}:{rows:Array<{id:string;title:string|null;posting_error:string|null}>;error?:string}) {
  return <section className="space-y-3 rounded-xl border border-amber-500/30 bg-card p-4">
    <h2 className="font-semibold">Envíos Pendientes De Verificar</h2>
    <p className="text-sm text-muted-foreground">Busca el post en Metricool y copia su ID. Verificaremos cliente, video, caption y redes antes de vincularlo. Esta acción no crea publicaciones.</p>
    {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
    {!error && rows.length===0 && <p className="text-sm text-muted-foreground">No Hay Envíos Pendientes</p>}
    {rows.map(row=><RecoveryRow key={row.id} row={row}/>)}
  </section>
}
function RecoveryRow({row}:{row:{id:string;title:string|null;posting_error:string|null}}) {
  const router=useRouter()
  const [value,setValue]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[done,setDone]=useState(false)
  async function verify(){
    setBusy(true);setMessage('')
    try{const result=await recoverMetricoolPost(row.id,Number(value));if(result.ok){setDone(true);setMessage('Post vinculado sin crear otra publicación.');router.refresh()}else setMessage(result.error ?? 'No se pudo verificar.')}
    catch{setMessage('No se pudo completar la verificación. El envío conserva su estado.')}finally{setBusy(false)}
  }
  return <div className="space-y-2 rounded-lg border p-3">
    <h3 className="text-sm font-medium">{row.title || 'Video Sin Título'}</h3>
    {!done && <><p className="break-words text-xs text-muted-foreground">{row.posting_error || 'El resultado del envío necesita confirmación.'}</p>
    <form className="flex flex-wrap items-end gap-2" onSubmit={e=>{e.preventDefault();void verify()}}>
      <label className="min-w-0 flex-1 text-xs">ID De Metricool<input value={value} onChange={e=>setValue(e.target.value)} inputMode="numeric" pattern="[0-9]+" required disabled={busy} className="mt-1 block h-10 w-full rounded-md border bg-background px-3"/></label>
      <button disabled={busy || !/^\d+$/.test(value)} className="h-10 rounded-md bg-primary px-3 text-sm text-primary-foreground disabled:opacity-50">{busy?'Verificando…':'Verificar Y Vincular'}</button>
    </form></>}
    {message && <p role="status" className="text-sm">{message}</p>}
  </div>
}
