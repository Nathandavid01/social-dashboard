'use client'

import {useState} from 'react'
import {Button} from '@/components/ui/button'
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog'
import {useHasPermission} from '@/components/auth/role-gate'
import {ClientCadenceEditor} from '@/components/clients/cadence/client-cadence-editor'
import type {ClientCadencePatch} from '@/lib/actions/client-cadence'
import type {CalendarClient} from './calendar-upload-dialog'
import styles from './content-calendar.module.css'

export function CalendarCadenceSettings({client,onSaved}:{client:CalendarClient;onSaved:(patch:ClientCadencePatch)=>void}){
 const allowed=useHasPermission('cadence.edit')
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false)
 if(!allowed)return null
 return <>
  <button type="button" aria-label={`Configurar frecuencia de ${client.name}`} onClick={()=>setOpen(true)} className="min-h-8 rounded-md px-2 text-[11px] text-primary hover:bg-accent">Configurar frecuencia</button>
  <Dialog open={open} onOpenChange={value=>{if(!busy)setOpen(value)}}><DialogContent className={`${styles.theme} max-h-[90vh] overflow-y-auto sm:max-w-xl`}>
   <DialogHeader><DialogTitle>Frecuencia · {client.name}</DialogTitle><DialogDescription>Elige los días y horarios. Los cambios se guardan automáticamente y actualizan los días previstos del calendario. Hora de Puerto Rico.</DialogDescription></DialogHeader>
   <ClientCadenceEditor key={`${client.id}:${open}`} clientId={client.id} initialDays={client.posting_days??[]} initialTime={client.posting_time??null} initialSchedule={client.posting_schedule??{}} initialTimezone={null} showTimezone={false} onSaved={onSaved} onPendingChange={setBusy}/>
   <p className="text-xs text-muted-foreground">Cambiar la frecuencia no mueve los posts que ya están programados en Metricool.</p>
   <Button type="button" variant="outline" disabled={busy} onClick={()=>setOpen(false)}>Listo</Button>
  </DialogContent></Dialog>
 </>
}
