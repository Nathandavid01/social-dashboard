import {expect,it,vi} from 'vitest'
vi.mock('@/lib/auth/server',()=>({requirePermission:async()=>{},currentUserHas:async()=>false}))
vi.mock('next/cache',()=>({revalidatePath:vi.fn()}))
vi.mock('@/lib/utils/review-notification',()=>({notifyReviewChange:async()=>undefined}))
const writes=vi.hoisted(()=>vi.fn())
vi.mock('@/lib/supabase/server',()=>({createClient:async()=>({auth:{getUser:async()=>({data:{user:{id:'editor'}}})},from:(table:string)=>{
 let actions:string[]=[]
 const q:any={select:()=>q,eq:(key:string,value:string)=>{if(key==='action')actions=[value];return q},in:(key:string,values:string[])=>{if(key==='action')actions=values;return q},is:()=>q,not:()=>q,order:()=>q,limit:()=>q,
 single:async()=>({data:{approval_status:'revision_needed',status:'producida',created_by:'editor'},error:null}),
 maybeSingle:async()=>({data:{id:'idea'},error:null}),update:(p:any)=>{writes(p);return q},
 then:(r:any)=>r({data:table==='content_idea_videos'?[{id:'old',uploaded_at:'2026-09-08T11:00:00Z'}]:table==='content_idea_activity'&&actions.includes('client_requested_changes')?[{created_at:'2026-09-08T12:00:00Z'}]:[],error:null})};return q
}})}))
import {resubmitForReview} from './pipeline-submit'
it('requires a new version after client comments, even without an internal correction',async()=>{expect((await resubmitForReview('idea')).error).toMatch(/nueva versión/);expect(writes).not.toHaveBeenCalled()})
