'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { Upload, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { useHasPermission } from '@/components/auth/role-gate'
import { useToast } from '@/lib/hooks/use-toast'
import { prepareCalendarUpload, finishCalendarUpload, getCalendarImageUploadUrl } from '@/lib/actions/calendar-upload'
import { uploadEntregasFileFast } from '@/lib/utils/entregas-fast-upload'
import { putBlob } from '@/lib/utils/upload-http'
import { resolvePlatforms } from '@/lib/utils/idea-posting-core'
import { validateCalendarUpload } from '@/lib/published/calendar-upload'
import { puertoRicoNow } from '@/lib/published/calendar-post'
import styles from './content-calendar.module.css'

export interface CalendarClient {id:string;name:string;metricool_blog_id:string|null;platforms?:string[]|null;default_platforms?:string[]|null}
export interface CalendarUploadSaved {clientId:string;dateTime:string;postId?:number;confirmed?:boolean}
export function CalendarUploadDialog({clients,clientId,initialDateTime,onSaved,onVerify,onBusy}:{clients:CalendarClient[];clientId?:string;initialDateTime?:string;onSaved:(result:CalendarUploadSaved)=>void;onVerify?:(scope:CalendarUploadSaved)=>void;onBusy?:(busy:boolean)=>void}) {
 const canUpload=useHasPermission('posting.calendar.upload')
 const {toast}=useToast()
 const [open,setOpen]=useState(false)
 const [selection,setSelection]=useState(clientId??'')
 const selectedClient=clients.find(c=>c.id===(clientId??selection))
 const networks=resolvePlatforms(selectedClient?.platforms,selectedClient?.default_platforms)
 const [selectedNetworks,setSelectedNetworks]=useState<string[]>([])
 const [file,setFile]=useState<File|null>(null)
 const [title,setTitle]=useState('')
 const [caption,setCaption]=useState('')
 const [dateTime,setDateTime]=useState(initialDateTime??`${puertoRicoNow().slice(0,10)}T12:00`)
 const [busy,setBusy]=useState(false)
 const [pending,startTransition]=useTransition()
 const busyRef=useRef(false)
 const [stage,setStage]=useState('')
 const [progress,setProgress]=useState(0)
 const [error,setError]=useState<string|null>(null)
 const [uncertain,setUncertain]=useState(false)
 const transaction=useRef<{ideaId:string;key?:string;prepared:boolean}|null>(null)
 const [prepared,setPrepared]=useState(false)
 const [uploaded,setUploaded]=useState(false)
 const [preview,setPreview]=useState<string|null>(null)
 useEffect(()=>{setSelectedNetworks(resolvePlatforms(selectedClient?.platforms,selectedClient?.default_platforms))},[selectedClient])
 useEffect(()=>{
  if(!file||!URL.createObjectURL)return
  const url=URL.createObjectURL(file);setPreview(url)
  return()=>URL.revokeObjectURL(url)
 },[file])
 if(!canUpload)return null
 const disabled=busy||pending
 const connected=!!selectedClient?.metricool_blog_id
 const mime=file?.type||(/\.mov$/i.test(file?.name??'')?'video/quicktime':/\.mp4$/i.test(file?.name??'')?'video/mp4':/\.png$/i.test(file?.name??'')?'image/png':/\.jpe?g$/i.test(file?.name??'')?'image/jpeg':'')
 async function save() {
  if(busyRef.current||uncertain||!file||!selectedClient)return
  const invalid=validateCalendarUpload({title,caption,fileName:file.name,mimeType:mime,sizeBytes:file.size,dateTime,platforms:selectedNetworks})
  if(invalid){setError(invalid);return}
  if(!connected){setError('Conecta este cliente con Metricool antes de subir contenido.');return}
  busyRef.current=true;onBusy?.(true);setBusy(true);setError(null)
  startTransition(()=>setStage('Preparando contenido…'))
  try {
   if(!transaction.current)transaction.current={ideaId:crypto.randomUUID(),prepared:false}
   const tx=transaction.current
   if(!tx.prepared) {
    const result=await prepareCalendarUpload({ideaId:tx.ideaId,clientId:selectedClient.id,title,caption,fileName:file.name,mimeType:mime,sizeBytes:file.size,dateTime,platforms:selectedNetworks})
    if(!result.ok||!result.ideaId)throw Error(result.error??'No se pudo preparar la subida.')
    tx.ideaId=result.ideaId;tx.prepared=true;setPrepared(true)
   }
   if(!tx.key) {
    setStage('Subiendo archivo…');setProgress(0)
    if(mime.startsWith('image/')) {
     const slot=await getCalendarImageUploadUrl({ideaId:tx.ideaId,fileName:file.name,contentType:mime})
     if(!slot.url||!slot.key)throw Error(slot.error??'No se pudo preparar la imagen.')
     await putBlob(slot.url,file,mime,{onProgress:loaded=>setProgress(Math.min(100,Math.round(loaded/file.size*100)))})
     tx.key=slot.key
    }else {
     const result=await uploadEntregasFileFast({ideaId:tx.ideaId,file,contentType:mime,onProgress:setProgress})
     tx.key=result.key
    }
    setUploaded(true);setProgress(100)
   }
   setStage('Guardando borrador en Metricool…')
   let result
   try {result=await finishCalendarUpload({ideaId:tx.ideaId,key:tx.key,fileName:file.name})}
   catch {setUncertain(true);throw Error('No se pudo confirmar el envío. Verifica Metricool antes de repetir.')}
   if(!result.ok){setUncertain(result.uncertain===true);throw Error(result.error??'No se pudo guardar el borrador.')}
   toast({title:result.confirmed?'Contenido guardado como borrador':'Borrador pendiente de verificar',description:result.warning??'Abre la tarjeta para elegir cuándo publicarlo.'})
   setOpen(false)
   onSaved({clientId:result.clientId??selectedClient.id,dateTime:result.dateTime??dateTime,postId:result.postId,confirmed:result.confirmed})
   transaction.current=null;setPrepared(false);setUploaded(false);setFile(null);setTitle('');setCaption('');setUncertain(false);setStage('')
  }catch(err){setError(err instanceof Error?err.message:'No se pudo completar la subida.');setStage('')}
  finally{busyRef.current=false;setBusy(false);onBusy?.(false)}
 }
 return <>
  <Button size="sm" onClick={()=>{if(!prepared)setDateTime(initialDateTime??`${puertoRicoNow().slice(0,10)}T12:00`);setOpen(true)}}><Upload className="h-4 w-4"/>Subir contenido</Button>
  <Dialog open={open} onOpenChange={value=>{if(!busyRef.current)setOpen(value)}}>
   <DialogContent className={`${styles.theme} max-h-[90vh] overflow-y-auto sm:max-w-xl`}>
    <DialogHeader><DialogTitle>Subir al calendario{clientId&&selectedClient?` · ${selectedClient.name}`:''}</DialogTitle><DialogDescription>Adjunta una imagen o video y guarda un borrador. Desde su tarjeta podrás programar la publicación.</DialogDescription></DialogHeader>
    <form onSubmit={e=>{e.preventDefault();void save()}} className="space-y-4">
     {!clientId&&<label className="block text-sm font-medium">Cliente<select aria-label="Cliente" value={selection} disabled={disabled||prepared} onChange={e=>setSelection(e.target.value)} className="mt-1 w-full rounded-md border bg-background p-2" required><option value="">Elige un cliente</option>{clients.map(c=><option key={c.id} value={c.id}>{c.name}{!c.metricool_blog_id?' · Sin conexión':''}</option>)}</select></label>}
     {selectedClient&&!connected&&<p role="alert" className="text-sm text-amber-700">Conecta este cliente con Metricool para guardar publicaciones en su calendario.</p>}
     <label className="block text-sm font-medium">Archivo<input aria-label="Archivo" type="file" accept="image/jpeg,image/png,video/mp4,video/quicktime,.mov" disabled={disabled||prepared} required={!file} onChange={e=>{const next=e.target.files?.[0]??null;setFile(next);if(next&&!title)setTitle(next.name.replace(/\.[^.]+$/,''))}} className="mt-1 w-full rounded-md border bg-background p-2 text-sm"/></label>
     <p className="text-xs text-muted-foreground">JPG/PNG hasta 20 MB · MP4/MOV hasta 2 GB</p>
     {preview&&(mime.startsWith('video/')?<video src={preview} controls className="max-h-48 w-full rounded-lg"/>:<img src={preview} alt="Vista previa del archivo" className="max-h-48 w-full rounded-lg object-contain"/>)}
     <label className="block text-sm font-medium">Título<input aria-label="Título" value={title} maxLength={200} required disabled={disabled||prepared} onChange={e=>setTitle(e.target.value)} className="mt-1 w-full rounded-md border bg-background p-2 text-sm"/></label>
     <label className="block text-sm font-medium">Caption<textarea aria-label="Caption" value={caption} required disabled={disabled||prepared} onChange={e=>setCaption(e.target.value)} rows={4} className="mt-1 w-full rounded-md border bg-background p-2 text-sm"/></label>
     <label className="block text-sm font-medium">Fecha y hora del borrador<input aria-label="Fecha y hora del borrador" type="datetime-local" step={60} value={dateTime} required disabled={disabled||prepared} onChange={e=>setDateTime(e.target.value)} className="mt-1 w-full rounded-md border bg-background p-2 text-sm"/></label>
     <p className="text-xs text-muted-foreground">Hora de Puerto Rico · El borrador no se publica automáticamente.</p>
     {selectedClient&&<fieldset disabled={disabled||prepared} className="space-y-2"><legend className="text-sm font-medium">Redes del cliente</legend><div className="flex flex-wrap gap-3">{networks.map(network=><label key={network} className="flex items-center gap-2 text-sm capitalize"><input type="checkbox" checked={selectedNetworks.includes(network)} onChange={e=>setSelectedNetworks(values=>e.target.checked?[...values,network]:values.filter(v=>v!==network))}/>{network}</label>)}</div></fieldset>}
     {busy&&<div role="status" className="space-y-2 text-sm"><p>{stage}</p>{stage.startsWith('Subiendo')&&<><progress value={progress} max={100} className="w-full"/><p>{progress}%</p></>}</div>}
     {error&&<p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
     {uncertain&&<Button type="button" variant="outline" onClick={()=>{if(selectedClient)onVerify?.({clientId:selectedClient.id,dateTime});setOpen(false)}}>Verificar calendario</Button>}
     <Button type="submit" className="w-full" disabled={disabled||uncertain||!file||!connected}>{busy&&<Loader2 className="h-4 w-4 animate-spin"/>}{uploaded?'Guardar borrador nuevamente':'Subir y guardar borrador'}</Button>
    </form>
   </DialogContent>
  </Dialog>
 </>
}
