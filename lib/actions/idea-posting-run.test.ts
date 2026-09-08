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
function database() {
 return {from(table:string) {
  let write=false
  const q:any={
    select:()=>q,order:()=>q,limit:()=>q,eq:()=>q,is:()=>q,or:()=>q,in:()=>q,neq:()=>q,
    update:(payload:Record<string,unknown>)=>{write=true;h.writes.push(payload);return q},
    single:async()=>({data:h.idea,error:null}),
    then:(resolve:any)=>resolve({data:table==='content_idea_activity'?(h.verified?[{metadata:{videoFileId:'approved-file',captionsVerified:true,videoVerified:true}}]:[]):write?[{id:'idea'}]:table==='content_idea_videos'?[{id:'approved-file',idea_id:'idea',kind:'edited',status:'uploaded',storage_provider:'entregas-r2',drive_file_id:'edited.mp4'}]:[],error:null}),
  };return q
 }} as any
}
beforeEach(()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-09-07T14:00:00Z'))
 h.verified=true;h.writes=[];h.post.mockReset().mockResolvedValue({data:{id:123,uuid:'remote'}});h.health.mockReset().mockResolvedValue({ok:true})
 h.idea={id:'idea',status:'producida',approval_status:'approved',approved_video_id:'approved-file',generated_caption:'Approved caption',publish_date:'2026-09-08',metricool_post_id:null,posted_at:null,client:{metricool_blog_id:'client-only',platforms:['instagram'],posting_time:'08:30'}}
})
afterEach(() => vi.useRealTimers())
describe('approval to Metricool boundary',()=>{
 it('schedules the exact approved Entregas video as a real post on tomorrow\'s date',async()=>{
  expect(await runIdeaPost(database(),'idea','owner',null,{manualScheduling:true})).toMatchObject({ok:true})
  expect(h.post).toHaveBeenCalledWith('Approved caption','client-only',['instagram'],undefined,'2026-09-08T08:30:00',expect.objectContaining({autoPublish:true,mediaUrls:['https://entregas.example/edited.mp4']}))
 })
 it.each([null,'2026-08-01'])('blocks missing/stale dates before claiming or posting: %s',async date=>{
  h.idea.publish_date=date;expect(await runIdeaPost(database(),'idea','owner',null,{manualScheduling:true})).toHaveProperty('skipped');expect(h.writes).toHaveLength(0);expect(h.post).not.toHaveBeenCalled()
 })
 it('does not publish a discarded idea even if its old approval remains',async()=>{
  h.idea.status='descartada';expect(await runIdeaPost(database(),'idea','owner',null,{manualScheduling:true})).toHaveProperty('skipped');expect(h.post).not.toHaveBeenCalled()
 })
 it('blocks an expired automatic time on the current PR day',async()=>{
  h.idea.publish_date='2026-09-07';expect(await runIdeaPost(database(),'idea','owner',null,{manualScheduling:true})).toHaveProperty('skipped');expect(h.post).not.toHaveBeenCalled()
 })
})

it('blocks scheduling without exact-file caption verification',async()=>{h.verified=false;expect(await runIdeaPost(database(),'idea','owner',null,{manualScheduling:true})).toHaveProperty('skipped');expect(h.post).not.toHaveBeenCalled()})

it('requires the explicit scheduling entrypoint',async()=>{expect(await runIdeaPost(database(),'idea','owner')).toHaveProperty('skipped');expect(h.post).not.toHaveBeenCalled()})
