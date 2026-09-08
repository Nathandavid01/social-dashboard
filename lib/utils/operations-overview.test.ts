import { describe, it, expect } from 'vitest'
import { buildOperationsOverview } from './operations-overview'
import type { IdeaWithPipeline } from '@/lib/supabase/types'
const today='2026-09-08'
const client={id:'c',name:'Arasibo',posting_days:[2],metricool_blog_id:'blog',posting_time:'18:00'}
const file={id:'f',kind:'edited',storage_provider:'entregas-r2',status:'uploaded',drive_file_id:'edited.mp4'}
const idea=(over:Record<string,unknown>={})=>({id:'i',client_id:'c',title:'Video de hoy',status:'producida',approval_status:'approved',generated_caption:'Copy',publish_date:today,approved_video_id:'f',reviewVerified:true,videos:[file],...over} as unknown as IdeaWithPipeline)
const build=(ideas:IdeaWithPipeline[])=>buildOperationsOverview(ideas,[client],[{id:'e',full_name:'Alexa',role:'editor',status:'active'}],today,Date.parse(today+'T14:00:00Z'))
describe('operations overview',()=>{
 it('keeps overdue work outside today and catches cadence without a dated video',()=>{
  const r=build([idea({publish_date:'2026-07-02'})]);expect(r.today).toHaveLength(1);expect(r.today[0].missing).toBe(true);expect(r.overdue).toHaveLength(1);expect(r.ready).toHaveLength(0)
 })
 it('counts approved videos with a valid schedule as ready, never discarded work',()=>{
  const r=build([idea(),idea({id:'discard',status:'descartada'})]);expect(r.ready).toHaveLength(1);expect(r.today).toHaveLength(1);expect(r.editors[0]).toMatchObject({free:2,limit:2})
 })
 it('does not call a Metricool id proof of publication',()=>{
  const r=build([idea({metricool_post_id:123})]);expect(r.ready).toHaveLength(0);expect(r.today[0]).toMatchObject({state:'Enviado · Falta Verificar',done:false})
 })
 it('counts only editor deliveries for review and separates corrections',()=>{
  const r=build([idea({approval_status:'submitted'}),idea({id:'old',approval_status:'submitted',videos:[{...file,storage_provider:'r2'}]}),idea({id:'fix',approval_status:'revision_needed'})]);expect(r.reviews).toHaveLength(1);expect(r.corrections).toHaveLength(1)
 })
 it('blocks missing copy, missing connection and missing approved file',()=>{
  expect(build([idea({generated_caption:''})]).ready).toHaveLength(0)
  expect(buildOperationsOverview([idea()],[{...client,metricool_blog_id:null}],[],today).ready).toHaveLength(0)
  expect(build([idea({approved_video_id:'gone'})]).ready).toHaveLength(0)
 })
})
