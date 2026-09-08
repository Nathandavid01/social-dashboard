import { beforeEach, expect, it, vi } from 'vitest'
const h=vi.hoisted(()=>({allow:vi.fn(),remote:vi.fn(),writes:vi.fn(),row:{} as any, raced:false}))
vi.mock('@/lib/auth/server',()=>({requirePermission:h.allow}))
vi.mock('next/cache',()=>({revalidatePath:vi.fn()}))
vi.mock('@/lib/metricool/post',()=>({getServerConfig:()=>({userToken:'t',userId:'u',blogId:'agency'})}))
vi.mock('@/lib/metricool/scheduler',()=>({getScheduledPosts:h.remote}))
vi.mock('@/lib/integrations/entregas-r2',()=>({entregasR2PublicUrl:()=> 'https://media.example/final.mp4'}))
vi.mock('@/lib/integrations/r2',()=>({r2PublicUrl:()=> 'https://legacy.example/final.mp4'}))
vi.mock('@/lib/supabase/server',()=>({createClient:async()=>({from:(table:string)=>{
 let write=false;const q:any={select:()=>q,eq:()=>q,is:()=>q,update:(p:any)=>{write=true;h.writes(p);return q},maybeSingle:async()=>({data:write?(h.raced?null:{id:'idea'}):table==='content_ideas'?h.row:{id:'file',kind:'edited',status:'uploaded',storage_provider:'entregas-r2',drive_file_id:'key'},error:null})};return q
}})}))
import { recoverMetricoolPost } from './metricool-recovery'
beforeEach(()=>{h.allow.mockReset();h.remote.mockReset();h.writes.mockReset();h.raced=false;h.row={id:'idea',generated_caption:'caption',approved_video_id:'file',posting_started_at:'2026-01-01T00:00:00Z',publish_date:'2026-09-10',client:{metricool_blog_id:'client-blog',platforms:['instagram']}};h.remote.mockResolvedValue([{id:12,uuid:'u',text:'caption',draft:false,autoPublish:true,providers:[{network:'instagram'}],media:['https://media.example/final.mp4']}])})
it('requires publication permission before reading remote data',async()=>{h.allow.mockRejectedValue(new Error('No autorizado'));expect((await recoverMetricoolPost('idea',12)).error).toBeTruthy();expect(h.remote).not.toHaveBeenCalled();expect(h.writes).not.toHaveBeenCalled()})
it('links a verified post scoped to its client without another POST',async()=>{expect(await recoverMetricoolPost('idea',12)).toEqual({ok:true});expect(h.remote.mock.calls[0][0].blogId).toBe('client-blog');expect(h.writes).toHaveBeenCalledWith(expect.objectContaining({metricool_post_id:12,metricool_uuid:'u'}))})
it('does not unlock a missing remote post',async()=>{h.remote.mockResolvedValue([]);expect((await recoverMetricoolPost('idea',12)).error).toBeTruthy();expect(h.writes).not.toHaveBeenCalled()})
it('reports concurrent changes instead of success',async()=>{h.raced=true;expect((await recoverMetricoolPost('idea',12)).error).toBeTruthy()})
