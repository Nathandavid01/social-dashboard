import {expect,it} from 'vitest'
import {briefingQueryIssue} from './briefing-query'
it('rejects database failures even if the response includes an empty list',()=>{
 expect(briefingQueryIssue({data:[],count:0,error:{message:'offline'}},'Tareas')).toContain('Tareas')
})
it('rejects truncated task inventories',()=>{
 expect(briefingQueryIssue({data:[{id:'a'}],count:1001,error:null},'Tareas')).toContain('incompleta')
})
it('accepts verified empty tasks and exact count-only results',()=>{
 expect(briefingQueryIssue({data:[],count:0,error:null},'Tareas')).toBeNull()
 expect(briefingQueryIssue({data:null,count:3,error:null},'QC',true)).toBeNull()
})
it('rejects missing counts and missing data rather than manufacturing zero',()=>{
 expect(briefingQueryIssue({data:null,count:null,error:null},'QC',true)).toBeTruthy()
 expect(briefingQueryIssue({data:null,count:0,error:null},'Tareas')).toBeTruthy()
})
