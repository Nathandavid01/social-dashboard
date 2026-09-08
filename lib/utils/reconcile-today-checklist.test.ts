import {expect,it} from 'vitest'
import {reconcileTodayChecklist} from './reconcile-today-checklist'
import {buildOperationsOverview} from './operations-overview'
import type {OperationalPublicationReport} from './operational-publications'
const data=buildOperationsOverview([],[{id:'c',name:'Client',posting_days:[2],metricool_blog_id:'1'}],[],'2026-09-08')
const report={today:data.date,clients:[{id:'c',days:[{date:data.date,covered:true,published:1,posts:[{id:1,state:'published'}]}]}]} as OperationalPublicationReport
it('recognizes a confirmed external publication without inventing internal approval',()=>{
 const rows=reconcileTodayChecklist(data.today,data.date,report)
 expect(rows[0]).toMatchObject({done:true,missing:false,state:'Publicado En Metricool · Sin Pieza Vinculada'})
 expect(rows[0].checks).toEqual([{label:'Publicado',done:true}])
 expect(data.today[0].done).toBe(false)
})
it.each(['scheduled','draft','partial','failed','unknown'])('does not complete the day for %s',state=>{
 const r=structuredClone(report);r.clients[0].days[0].covered=false;r.clients[0].days[0].published=0;r.clients[0].days[0].posts[0].state=state
 expect(reconcileTodayChecklist(data.today,data.date,r)[0].done).toBe(false)
})
it('ignores stale or failed evidence',()=>{
 expect(reconcileTodayChecklist(data.today,data.date,{...report,today:'2026-09-07'})[0].done).toBe(false)
 const r=structuredClone(report);r.clients[0].error='offline'
 expect(reconcileTodayChecklist(data.today,data.date,r)[0].done).toBe(false)
})
it('does not match an unrelated external post to a real internal video',()=>{
 const rows=[{...data.today[0],missing:false,id:'real-video'}]
 expect(reconcileTodayChecklist(rows,data.date,report)[0].done).toBe(false)
})
