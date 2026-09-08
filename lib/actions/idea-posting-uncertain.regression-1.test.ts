import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
const h = vi.hoisted(()=>({
  idea:{} as Record<string,unknown>, writes:[] as Record<string,unknown>[],
  post:vi.fn(),health:vi.fn(),verified:true,
}))
vi.mock('next/cache',()=>({revalidatePath:vi.fn()}))
vi.mock('@/lib/metricool/post',()=>({createDraftPost:h.post}))
vi.mock('@/lib/integrations/video-health',()=>({checkVideoPlayable:h.health}))
vi.mock('@/lib/integrations/r2',()=>({r2PublicUrl:()=> 'https://pipeline.example/edited.mp4'}))
vi.mock('@/lib/integrations/entregas-r2',()=>({entregasR2PublicUrl:()=> 'https://entregas.example/edited.mp4'}))
vi.mock('@/lib/utils/idea-activity',()=>({logIdeaActivity:vi.fn()}))
import { runIdeaPost } from './idea-posting-run'
let claim: string | null = null
function database() {
 return {from(table:string) {
  let payload:Record<string,unknown>|null=null
  let requiresFree=false
  const q:any={
    select:()=>q,order:()=>q,limit:()=>q,eq:()=>q,or:()=>q,in:()=>q,neq:()=>q,
    is:(key:string)=>{if(key==='posting_started_at')requiresFree=true;return q},
    update:(value:Record<string,unknown>)=>{payload=value;h.writes.push(value);return q},
    single:async()=>({data:h.idea,error:null}),
    then:(resolve:any)=>{
      if(payload){
        if(requiresFree && claim) return resolve({data:[],error:null})
        if('posting_started_at' in payload) claim=payload.posting_started_at as string|null
        return resolve({data:[{id:'idea'}],error:null})
      }
      return resolve({data:table==='content_idea_activity'?[{metadata:{videoFileId:'approved-file',captionsVerified:true,videoVerified:true}}]:[{id:'approved-file',idea_id:'idea',kind:'edited',status:'uploaded',storage_provider:'entregas-r2',drive_file_id:'edited.mp4'}],error:null})
    },
  };return q
 }} as any
}
beforeEach(()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-09-07T14:00:00Z'))
 claim=null;h.verified=true;h.writes=[];h.post.mockReset().mockResolvedValue({data:{id:123,uuid:'remote'}});h.health.mockReset().mockResolvedValue({ok:true})
 h.idea={id:'idea',status:'producida',approval_status:'approved',approved_video_id:'approved-file',generated_caption:'Approved caption',publish_date:'2026-09-08',metricool_post_id:null,posted_at:null,client:{metricool_blog_id:'client-only',platforms:['instagram'],posting_time:'08:30'}}
})
afterEach(() => vi.useRealTimers())

it('keeps an uncertain creation locked even after five minutes and a manual retry', async()=>{
 h.post.mockRejectedValue(new Error('Timeout'))
 expect((await runIdeaPost(database(),'idea','owner',null,{manualScheduling:true})).error).toMatch(/verificar|confirmar/i)
 expect(claim).not.toBeNull()
 vi.advanceTimersByTime(6*60*1000)
 expect(await runIdeaPost(database(),'idea','owner',null,{manualScheduling:true})).toHaveProperty('skipped')
 expect(h.post).toHaveBeenCalledTimes(1)
})
it('releases a definitely rejected request for a corrected retry',async()=>{
 h.post.mockRejectedValue(Object.assign(new Error('Invalid media'),{definitelyNotCreated:true}))
 expect((await runIdeaPost(database(),'idea','owner',null,{manualScheduling:true})).error).toMatch(/Invalid media/)
 expect(claim).toBeNull()
})
it('does not declare success for a response without a remote identifier',async()=>{
 h.post.mockResolvedValue({data:{}})
 expect((await runIdeaPost(database(),'idea','owner',null,{manualScheduling:true})).error).toBeTruthy()
 expect(claim).not.toBeNull()
})
