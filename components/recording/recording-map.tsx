'use client'
import {useState} from 'react'
import {clientDisplayName} from '@/lib/utils/client-display-name'
type MapSession={id:string;title:string;session_date:string;location_lat?:number|null;location_lng?:number|null}
export function RecordingMap({sessions,onOpen}:{sessions:MapSession[];onOpen:(id:string)=>void}) {
 const [selected,setSelected]=useState<string|null>(null)
 const located=sessions.filter(s=>typeof s.location_lat==='number'&&Number.isFinite(s.location_lat)&&Math.abs(s.location_lat)<=90&&typeof s.location_lng==='number'&&Number.isFinite(s.location_lng)&&Math.abs(s.location_lng)<=180)
 const active=located.find(s=>s.id===selected)
 const lat=active?.location_lat,lng=active?.location_lng
 const bbox=active&&lat!=null&&lng!=null?`${lng-.08},${lat-.05},${lng+.08},${lat+.05}`:'-67.35,17.85,-65.2,18.6'
 const params=new URLSearchParams({bbox,layer:'mapnik'})
 if(active)params.set('marker',`${lat},${lng}`)
 return <section className="overflow-hidden rounded-xl border border-sky-500/25 bg-sky-500/5">
  <div className="flex flex-wrap items-center justify-between gap-3 p-4"><div><h3 className="font-semibold">Grabaciones En Puerto Rico</h3><p className="mt-1 text-xs text-muted-foreground">{located.length} Con Ubicación · {sessions.length-located.length} Sin Coordenadas · Selecciona Una Sesión Para Ubicarla</p></div><button className="min-h-11 rounded-lg border px-3 text-sm" onClick={()=>setSelected(null)}>Ver Puerto Rico</button></div>
  <iframe title="Mapa De Grabaciones En Puerto Rico" src={`https://www.openstreetmap.org/export/embed.html?${params}`} className="h-80 w-full border-0 sm:h-96" loading="lazy" referrerPolicy="no-referrer" />
  <div className="grid max-h-64 gap-2 overflow-y-auto p-4 sm:grid-cols-2">{sessions.map(s=><div key={s.id} className="flex min-w-0 items-center gap-2 rounded-lg border bg-background p-3"><button className="min-h-11 min-w-0 flex-1 text-left text-sm disabled:opacity-60" disabled={!located.some(l=>l.id===s.id)} onClick={()=>setSelected(s.id)}><span className="block break-words font-medium">{clientDisplayName(s.title)}</span><span className="text-xs text-muted-foreground">{s.session_date}{!located.some(l=>l.id===s.id)?' · Falta GPS':''}</span></button><button onClick={()=>onOpen(s.id)} className="min-h-11 shrink-0 px-2 text-xs text-sky-500">Ver Sesión</button></div>)}</div>
  {!located.length&&<p className="px-4 pb-4 text-sm text-muted-foreground">Guarda la ubicación GPS en Editar Sesión para situarla en el mapa. No se deduce una dirección a partir del nombre.</p>}
 </section>
}
