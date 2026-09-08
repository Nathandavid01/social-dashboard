import {beforeEach,expect,it,vi} from 'vitest'
const h=vi.hoisted(()=>({idea:{} as any,changed:false,filters:[] as any[],writes:[] as any[]}))
vi.mock('@/lib/auth/server',()=>({requirePermission:async()=>{},currentUserHas:async()=>false}))
vi.mock('next/cache',()=>({revalidatePath:vi.fn()}))
vi.mock('@/lib/supabase/server',()=>({createClient:async()=>({auth:{getUser:async()=>({data:{user:{id:'editor'}}})},from:(table:string)=>{let write=false;const q:any={select:()=>q,eq:(...a:any[])=>{if(write)h.filters.push(a);return q},is:(...a:any[])=>{if(write)h.filters.push(a);return q},not:()=>q,order:()=>q,limit:()=>q,single:async()=>({data:h.idea,error:null}),update:(p:any)=>{write=true;h.writes.push(p);return q},maybeSingle:async()=>({data:h.changed?null:{id:'idea'},error:null}),then:(r:any)=>r({data:table==='content_idea_videos'?[{id:'new',uploaded_at:'2026-09-08T12:00:00Z'}]:table==='content_idea_activity'?[{created_at:'2026-09-08T11:00:00Z'}]:[],error:null})};return q}})}))
import {resubmitForReview} from './pipeline-submit'
beforeEach(()=>{h.idea={approval_status:'revision_needed',status:'producida',created_by:'editor'};h.changed=false;h.filters=[];h.writes=[]})
it.each([{metricool_post_id:12},{posted_at:'2026-09-08T12:00:00Z'},{posting_started_at:'2026-09-08T12:00:00Z'},{status:'publicada'},{status:'descartada'}])('does not reopen a sent, sending, or closed video %j',async fields=>{Object.assign(h.idea,fields);expect((await resubmitForReview('idea')).error).toBeTruthy();expect(h.writes).toHaveLength(0)})
it('does not claim success when the status changes before writing',async()=>{h.changed=true;expect((await resubmitForReview('idea')).error).toBeTruthy()})
it('resubmits an unchanged correction with a newer file',async()=>{expect(await resubmitForReview('idea')).toEqual({ok:true});expect(h.filters).toEqual(expect.arrayContaining([['approval_status','revision_needed'],['posting_started_at',null],['metricool_post_id',null]]))})
