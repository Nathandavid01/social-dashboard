import { describe,it,expect } from 'vitest'
import { recordingPendingTasks } from './recording-pending'
const session={id:'s',title:'Cliente',session_date:'2026-09-18',status:'scheduled',client_id:'c',videographer_id:'v',client:{name:'Cliente',assigned_to:'e',posting_days:[1]}}
describe('monthly recording preparation',()=>{
 it('counts a session once and lists every missing requirement',()=>{
 const result=recordingPendingTasks([{...session,videographer_id:null,client:{...session.client,assigned_to:null}}],[],'2026-09')
 expect(result).toHaveLength(1);expect(result[0].reasons).toEqual(['Asignar Videógrafo','Asignar Editor','Faltan 6 Ideas (0/6)'])
 })
 it('excludes completed, cancelled, other months and ready sessions',()=>{
 const ideas=Array.from({length:6},(_,i)=>({id:String(i),client_id:'c',recording_session_id:'s',status:'idea',title:'Idea'}))
 expect(recordingPendingTasks([session,{...session,id:'a',status:'completed'},{...session,id:'b',status:'cancelled'},{...session,id:'c',session_date:'2026-10-01'}],ideas,'2026-09')).toEqual([])
 })
 it('does not count discarded, blank, unrelated or duplicate ideas',()=>{
 const idea={id:'i',client_id:'c',recording_session_id:'s',status:'idea',title:'Idea'}
 const result=recordingPendingTasks([session],[idea,idea,{...idea,id:'b',title:' '},{...idea,id:'c',status:'descartada'},{...idea,id:'d',client_id:'other'}],'2026-09')
 expect(result[0].reasons).toContain('Faltan 5 Ideas (1/6)')
 })
 it('keeps overdue scheduled sessions and undefined client targets actionable',()=>{
 const result=recordingPendingTasks([{...session,session_date:'2026-09-01',client_id:null,client:null}],[],'2026-09')
 expect(result[0].reasons).toEqual(['Vincular Cliente','Definir Meta De Ideas'])
 })
})
