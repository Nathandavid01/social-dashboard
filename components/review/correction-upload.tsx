'use client'
import {useState} from 'react'
import {useRouter} from 'next/navigation'
import {getEntregasUploadUrl,registerEntregasVideo} from '@/lib/actions/entregas-r2'
import {resubmitForReview,checkCorrectionOwner} from '@/lib/actions/pipeline-submit'
export function CorrectionUpload({ideaId}:{ideaId:string}){
 const [file,setFile]=useState<File|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),router=useRouter()
 async function submit(){if(!file)return;setBusy(true);setMessage('Comprobando Asignación…');try{
  const allowed=await checkCorrectionOwner(ideaId);if(allowed.error)throw Error(allowed.error)
  const type=file.type || (file.name.toLowerCase().endsWith('.mov')?'video/quicktime':'video/mp4')
  const signed=await getEntregasUploadUrl({ideaId,fileName:file.name,contentType:type});if(signed.error||!signed.url||!signed.key)throw Error(signed.error??'No se pudo preparar la subida.')
  setMessage('Subiendo Nueva Versión…')
  const put=await fetch(signed.url,{method:'PUT',body:file,headers:{'Content-Type':type}});if(!put.ok)throw Error('La subida falló. Intenta otra vez.')
  const registered=await registerEntregasVideo({ideaId,key:signed.key,name:file.name,sizeBytes:file.size,mimeType:type});if(registered.error)throw Error(registered.error)
  const sent=await resubmitForReview(ideaId);if(sent.error)throw Error(sent.error)
  setMessage(sent.warning ?? 'Corrección Enviada A Revisión');setFile(null);router.refresh()
 }catch(e){setMessage(e instanceof Error?e.message:'No se pudo enviar la corrección.')}finally{setBusy(false)}}
 return <div className="mt-3 space-y-2"><p className="text-xs text-muted-foreground">Sube el video corregido con subtítulos incrustados. Conserva la fecha y el historial de esta pieza.</p><input type="file" accept="video/*" aria-label="Video Corregido" disabled={busy} onChange={e=>setFile(e.target.files?.[0]??null)} className="block w-full min-w-0 text-xs"/><button disabled={busy||!file} onClick={submit} className="min-h-11 rounded-lg bg-violet-600 px-3 text-xs font-medium text-white disabled:opacity-50">{busy?'Enviando…':'Subir Corrección Y Enviar A Revisión'}</button>{message&&<p role="status" className="text-xs">{message}</p>}</div>
}
