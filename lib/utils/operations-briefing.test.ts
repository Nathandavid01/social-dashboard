import { expect, it } from 'vitest'
import { formatOperationsBriefing } from './operations-briefing'
import type { OperationsOverview, OverviewItem } from './operations-overview'
const item: OverviewItem = { id:'a',title:'Video',client:'Cliente',owner:'Editor',date:'2026-09-08',state:'Enviado · Falta Verificar',done:false,href:'/produccion/idea/a',checks:[{label:'Publicado',done:false}] }
const overview: OperationsOverview = { date:'2026-09-08',today:[item],overdue:[],reviews:[item],corrections:[],ready:[],blocked:[],uploads:[],editors:[{id:'e',name:'Editor',used:1,limit:3,free:2}] }
it('preserves the dashboard state and checklist without inventing publication',()=>{
 const result=formatOperationsBriefing({data:overview})
 expect(result).toContain('Enviado · Falta Verificar')
 expect(result).toContain('Publicado: pendiente')
 expect(result).toContain('Revisión: 1')
 expect(result).toContain('Editor: 1/3 ocupados · 2 libres')
})
it('never substitutes zero counts when the overview fails',()=>{
 const result=formatOperationsBriefing({error:'Consulta incompleta'})
 expect(result).toContain('Consulta incompleta')
 expect(result).not.toContain('Revisión: 0')
})
it('does not imply team clearance when the viewer lacks access',()=>{
 expect(formatOperationsBriefing(null)).toContain('Sin acceso')
})
it('keeps totals exact and labels a shortened detail list',()=>{
 const result=formatOperationsBriefing({data:{...overview,today:Array.from({length:30},(_,n)=>({...item,id:String(n),title:`Clip ${n}`}))}})
 expect(result).toContain('Hoy: 30')
 expect(result).toContain('22 más')
 expect(result).not.toContain('Clip 29')
})
it('matches Mi Dia completion when Metricool confirms an external daily commitment',()=>{
 const source={...overview,today:[{...item,id:'missing-c',missing:true,state:'Sin Video Fechado'}]}
 const evidence={report:{today:overview.date,clients:[{id:'c',days:[{date:overview.date,covered:true,published:1}]}]}} as any
 const result=formatOperationsBriefing({data:source},evidence)
 expect(result).toContain('Publicados Hoy: 1')
 expect(result).toContain('Por Publicar Hoy: 0')
 expect(result).toContain('Publicado En Metricool · Sin Pieza Vinculada')
})
it('explicitly marks remote reconciliation as incomplete on failure',()=>{
 const result=formatOperationsBriefing({data:overview},{error:'Metricool Sin Verificar'})
 expect(result).toContain('Metricool Sin Verificar')
 expect(result).toContain('No se confirmó la conciliación')
})
