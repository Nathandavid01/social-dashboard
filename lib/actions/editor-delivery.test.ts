import {beforeEach,it,expect,vi} from 'vitest'
const h=vi.hoisted(()=>({idea:{} as any,file:{} as any,updates:[] as any[],notify:vi.fn()}))
vi.mock('@/lib/auth/server',()=>({requirePermission:async()=>{},currentUserHas:async()=>false}))
vi.mock('next/cache',()=>({revalidatePath:vi.fn()}))
vi.mock('@/lib/utils/review-notification',()=>({notifyReviewChange:h.notify}))
vi.mock('@/lib/supabase/server',()=>({createClient:async()=>({auth:{getUser:async()=>({data:{user:{id:'editor'}}})},from:(table:string)=>{const q:any={select:()=>q,eq:()=>q,is:()=>q,not:()=>q,update:(v:any)=>{h.updates.push(v);return q},single:async()=>({data:h.idea}),maybeSingle:async()=>({data:table==='content_idea_videos'?h.file:{id:'idea'}})};return q}})}))
import {submitEditorDelivery} from './editor-delivery'
beforeEach(()=>{h.idea={id:'idea',status:'grabada',approval_status:'pending',title:'Mi Idea',production_task:{assigned_to_id:'editor'}};h.file={id:'file',uploaded_by:'editor',drive_file_id:'entregas/idea/edited/test.mp4'};h.updates=[];h.notify.mockReset()})
it('submits the original idea without changing its brief or publication date',async()=>{expect(await submitEditorDelivery('idea','file')).toMatchObject({ok:true});expect(h.updates[0]).toMatchObject({status:'producida',approval_status:'submitted'});expect(h.updates[0]).not.toHaveProperty('publish_date');expect(h.notify).toHaveBeenCalled()})
it('does not submit without an edited file',async()=>{h.file=null;expect(await submitEditorDelivery('idea','file')).toHaveProperty('error');expect(h.updates).toEqual([])})
it('denies another editors work',async()=>{h.idea.production_task.assigned_to_id='other';expect(await submitEditorDelivery('idea','file')).toHaveProperty('error');expect(h.updates).toEqual([])})
it('does not replace a review or a scheduled publication',async()=>{h.idea.approval_status='submitted';expect(await submitEditorDelivery('idea','file')).toHaveProperty('error');h.idea.approval_status='pending';h.idea.metricool_post_id=123;expect(await submitEditorDelivery('idea','file')).toHaveProperty('error');expect(h.updates).toEqual([])})
