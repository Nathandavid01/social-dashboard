'use client'
import {useState} from 'react'
import {useRouter} from 'next/navigation'
import {useHasPermission} from '@/components/auth/role-gate'
import type {EditorBankClip} from '@/lib/pipeline/editor-video-bank'
import type {GlobalBrollFile} from '@/lib/pipeline/global-broll'
import {getR2DownloadUrl} from '@/lib/actions/idea-videos-r2'
import {getEntregasDownloadUrl,getEntregasUploadUrl,registerEntregasVideo} from '@/lib/actions/entregas-r2'
import {checkEditorDelivery,submitEditorDelivery} from '@/lib/actions/editor-delivery'

export function EditorWorkPackage({clip,broll=[]}:{clip:EditorBankClip;broll?:GlobalBrollFile[]}){
 const router=useRouter(),canUpload=useHasPermission('video.upload')
 const [file,setFile]=useState<File|null>(null),[captions,setCaptions]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[registered,setRegistered]=useState<string|null>(null),[sent,setSent]=useState(false)
 const files=[...new Map([...clip.files,...broll.map(f=>({...f,kind:'broll' as const}))].map(f=>[f.id,f])).values()]
 async function download(source:typeof files[number]){
  setMessage('Preparando Descarga…')
  try{
   const result=source.storageProvider==='r2'?await getR2DownloadUrl(source.id):source.storageProvider==='entregas-r2'?await getEntregasDownloadUrl(source.id):{url:source.driveViewLink??undefined}
   if(!result.url)throw Error('error' in result?result.error:'Archivo No Disponible')
   const a=document.createElement('a');a.href=result.url;a.target='_blank';a.rel='noopener noreferrer';a.download=source.name;document.body.appendChild(a);a.click();a.remove();setMessage('Descarga Solicitada · '+source.name)
  }catch(e){setMessage(e instanceof Error?e.message:'No Se Pudo Descargar')}
 }
 async function submit(){if(!file||!captions)return;setBusy(true);try{
  const allowed=await checkEditorDelivery(clip.ideaId);if(allowed.error)throw Error(allowed.error)
  let videoId=registered
  if(!videoId){
   setMessage('Subiendo Video Editado…')
   const type=file.type||(file.name.toLowerCase().endsWith('.mov')?'video/quicktime':'video/mp4')
   const signed=await getEntregasUploadUrl({ideaId:clip.ideaId,fileName:file.name,contentType:type});if(signed.error||!signed.url||!signed.key)throw Error(signed.error||'No Se Pudo Preparar La Subida')
   const put=await fetch(signed.url,{method:'PUT',body:file,headers:{'Content-Type':type}});if(!put.ok)throw Error('La Subida Falló. Intenta Otra Vez.')
   setMessage('Registrando Archivo…')
   const saved=await registerEntregasVideo({ideaId:clip.ideaId,key:signed.key,name:file.name,sizeBytes:file.size,mimeType:type});if(saved.error||!saved.id)throw Error(saved.error||'No Se Pudo Registrar El Archivo');videoId=saved.id;setRegistered(videoId)
  }
  setMessage('Enviando A Supervisión…');const result=await submitEditorDelivery(clip.ideaId,videoId);if(!('ok' in result)||!result.ok)throw Error(result.error||'No Se Pudo Confirmar El Envío')
  setSent(true);setMessage(result.warning||'Enviado A Revisión · El Supervisor Aprobará O Pedirá Cambios');router.refresh()
 }catch(e){setMessage(e instanceof Error?e.message:'No Se Pudo Confirmar La Entrega')}finally{setBusy(false)}}
 return <details className="mt-2 rounded-lg border border-sky-500/30 bg-sky-500/5 p-2 text-xs"><summary className="min-h-9 cursor-pointer py-2 font-semibold text-sky-300">Abrir Material Y Entregar</summary><div className="space-y-3 pt-2"><section className="space-y-1"><h4 className="font-semibold">1 · Idea E Instrucciones</h4>{[clip.hook,clip.visualBrief,clip.shootingNotes].filter(Boolean).map((text,i)=><p key={i} className="whitespace-pre-wrap break-words text-slate-300">{text}</p>)}{!clip.hook&&!clip.visualBrief&&!clip.shootingNotes&&<p className="text-slate-400">Esta Idea Todavía No Tiene Instrucciones.</p>}</section><section><h4 className="mb-2 font-semibold">2 · Descargar Material · {files.length} Archivos</h4><ul className="space-y-2">{files.map(source=><li key={source.id} className="rounded border border-white/10 p-2"><span className="block break-words">{source.name}</span><button type="button" onClick={()=>download(source)} className="mt-1 min-h-9 text-sky-300 underline">Descargar {source.kind==='broll'?'B-roll':'Crudo'}</button></li>)}</ul></section>{canUpload&&<section className="space-y-2"><h4 className="font-semibold">3 · Entregar El Editado</h4><p className="text-slate-400">Se conserva esta idea, sus instrucciones y su fecha. Si el supervisor pide cambios, recibirás el comentario para corregir y reenviar.</p><input aria-label="Video Editado" type="file" accept="video/*" disabled={busy||sent} onChange={e=>{setFile(e.target.files?.[0]??null);setRegistered(null);setCaptions(false)}} className="block w-full min-w-0 text-xs"/><label className="flex items-start gap-2"><input type="checkbox" checked={captions} disabled={busy||sent} onChange={e=>setCaptions(e.target.checked)}/>El Editado Incluye Subtítulos Y Revisé Audio, Marca Y Cierre</label><button type="button" disabled={!file||!captions||busy||sent} onClick={submit} className="min-h-11 rounded-lg bg-sky-600 px-3 font-semibold text-white disabled:opacity-50">{busy?'Enviando…':sent?'En Revisión':'Enviar A Revisión'}</button></section>}{message&&<p role="status" className="break-words text-sky-200">{message}</p>}</div></details>
}
