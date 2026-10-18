import { beforeEach, describe, it, expect, vi } from 'vitest'
const h=vi.hoisted(()=>({denied:false, user:'owner', client:{id:'c',name:'Cliente',status:'active',metricool_blog_id:'1',platforms:['instagram'],default_platforms:[]}, idea:null as any, metadata:{source:'calendar_upload',stage:'prepared',dateTime:'2099-10-20T10:30',platforms:['instagram'],fileName:'photo.jpg',mimeType:'image/jpeg',sizeBytes:1024} as Record<string,unknown>, claimed:true,writes:[] as any[],filters:[] as any[],recordFailure:false}))
vi.mock('@/lib/auth/server',()=>({requirePermission:vi.fn(async()=>{if(h.denied)throw Error('denied')})}))
vi.mock('next/cache',()=>({revalidatePath:vi.fn()}))
vi.mock('@/lib/supabase/server',()=>({createClient:async()=>({auth:{getUser:async()=>({data:{user:{id:h.user}}})},from:(table:string)=>{
 let operation='read', payload:any
 const q:any={select:()=>q,eq:(...args:any[])=>{h.filters.push(args);return q},is:(...args:any[])=>{h.filters.push(args);return q},contains:()=>q,order:()=>q,limit:()=>q,
 update:(p:any)=>{operation='update';payload=p;h.writes.push({table,p});return q},insert:(p:any)=>{operation='insert';payload=p;h.writes.push({table,p});return q},
 maybeSingle:async()=>({data:table==='clients'?h.client:table==='content_ideas'?h.idea:table==='content_idea_activity'?{metadata:h.metadata}:null,error:null}),
 single:async()=>({data:table==='clients'?h.client:table==='content_ideas'?h.idea:{id:'file'},error:null}),
 then:(resolve:any)=>resolve({data:operation==='update'&&payload?.posting_started_at?h.claimed?[{id:h.idea?.id}]:[]:table==='content_ideas'&&operation==='insert'?[payload]:[],error:h.recordFailure&&payload?.metricool_post_id?{message:'database down'}:null})}
 return q
}})}))
const storage=vi.hoisted(()=>({send:vi.fn(async()=>({ContentType:'image/jpeg',ContentLength:1024}))}))
vi.mock('@/lib/integrations/entregas-r2',()=>({entregasR2Client:()=>storage,entregasR2Bucket:()=> 'entregas',isEntregasR2Configured:()=>true,entregasR2PublicUrl:(key:string)=>`https://media.example/${key}`}))
vi.mock('@aws-sdk/s3-request-presigner',()=>({getSignedUrl:async()=> 'https://signed.example/upload'}))
const remote=vi.hoisted(()=>({create:vi.fn(async()=>({data:{id:77,uuid:'post'}})),get:vi.fn(async()=>({id:77,uuid:'post',draft:true,autoPublish:false,text:'Caption',providers:[{network:'instagram',status:'PENDING'}],publicationDate:{dateTime:'2099-10-20T10:30:00',timezone:'America/Puerto_Rico'},media:[{url:'https://media.example/entregas/idea/edited/photo.jpg'}]}))}))
vi.mock('@/lib/metricool/post',()=>({getServerConfig:()=>({userToken:'test',userId:'test',blogId:'default'}),createDraftPost:remote.create}))
vi.mock('@/lib/metricool/scheduler',()=>({getScheduledPost:remote.get}))
vi.mock('@/lib/utils/idea-activity',()=>({logIdeaActivity:vi.fn()}))
import {prepareCalendarUpload,finishCalendarUpload,getCalendarImageUploadUrl} from './calendar-upload'
const prepare={ideaId:'11111111-1111-4111-8111-111111111111',clientId:'c',title:'Post',caption:'Caption',fileName:'photo.jpg',mimeType:'image/jpeg',sizeBytes:1024,dateTime:'2099-10-20T10:30',platforms:['instagram']}
const finish={ideaId:'idea',key:'entregas/idea/edited/photo.jpg',fileName:'photo.jpg'}
beforeEach(()=>{vi.clearAllMocks();h.denied=false;h.user='owner';h.idea={id:'idea',created_by:'owner',client_id:'c',theme:'calendar-upload',title:'Post',generated_caption:'Caption',content_type:'P',metricool_post_id:null,metricool_uuid:null,posting_started_at:null,publish_date:'2099-10-20'};h.metadata={source:'calendar_upload',stage:'prepared',dateTime:'2099-10-20T10:30',platforms:['instagram'],fileName:'photo.jpg',mimeType:'image/jpeg',sizeBytes:1024};h.claimed=true;h.writes=[];h.filters=[];h.recordFailure=false;storage.send.mockResolvedValue({ContentType:'image/jpeg',ContentLength:1024});remote.create.mockResolvedValue({data:{id:77,uuid:'post'}})})
describe('direct calendar upload actions',()=>{
 it('checks permission before preparing upload or remote mutation',async()=>{h.denied=true;expect((await prepareCalendarUpload(prepare)).error).toBeTruthy();expect((await finishCalendarUpload(finish)).error).toBeTruthy();expect(remote.create).not.toHaveBeenCalled();expect(storage.send).not.toHaveBeenCalled()})
 it('refuses a missing client account and networks not configured for that client',async()=>{const old=h.client;h.client={...old,metricool_blog_id:''};expect((await prepareCalendarUpload(prepare)).error).toBeTruthy();h.client=old;expect((await prepareCalendarUpload({...prepare,platforms:['tiktok']})).error).toBeTruthy()})
 it('rejects another user’s idea and foreign storage keys before looking at media',async()=>{h.idea.created_by='other';expect((await finishCalendarUpload(finish)).error).toBeTruthy();h.idea.created_by='owner';expect((await finishCalendarUpload({...finish,key:'entregas/other/edited/photo.jpg'})).error).toBeTruthy();expect(storage.send).not.toHaveBeenCalled()})
 it('registers media only after checking actual storage and atomically claiming the draft creation',async()=>{
 const result=await finishCalendarUpload(finish)
 expect(result).toMatchObject({ok:true,postId:77,confirmed:true})
 expect(remote.create).toHaveBeenCalledWith('Caption','1',['instagram'],undefined,'2099-10-20T10:30',expect.objectContaining({mediaUrls:['https://media.example/entregas/idea/edited/photo.jpg'],autoPublish:false,contentType:'P'}))
 expect(h.filters).toContainEqual(['posting_started_at',null]);expect(h.writes.find(w=>w.table==='content_idea_videos').p).toMatchObject({storage_provider:'entregas-r2',mime_type:'image/jpeg',size_bytes:1024})
 expect(h.writes.some(w=>w.p?.approval_status)).toBe(false)
 })
 it('rejects absent or unsafe files without sending to Metricool',async()=>{storage.send.mockResolvedValue({ContentType:'text/html',ContentLength:1024});expect((await finishCalendarUpload(finish)).error).toBeTruthy();expect(remote.create).not.toHaveBeenCalled()})
 it('never replays after a durable claim or a lost Metricool response',async()=>{h.claimed=false;expect((await finishCalendarUpload(finish)).uncertain).toBe(true);expect(remote.create).not.toHaveBeenCalled();h.claimed=true;remote.create.mockRejectedValueOnce(Error('timeout'));expect((await finishCalendarUpload(finish)).uncertain).toBe(true);expect(h.writes.some(w=>w.p?.posting_started_at===null)).toBe(false)})
 it('returns an existing linked post instead of creating another on retry',async()=>{h.idea.metricool_post_id=77;h.idea.metricool_uuid='post';expect((await finishCalendarUpload(finish)).postId).toBe(77);expect(remote.create).not.toHaveBeenCalled()})
 it('reports accepted creation if dashboard persistence fails and keeps the claim',async()=>{h.recordFailure=true;const result=await finishCalendarUpload(finish);expect(result.uncertain).toBe(true);expect(result.postId).toBe(77);expect(h.writes.some(w=>w.p?.posting_started_at===null)).toBe(false)})
 it('only signs raster image uploads for the owned calendar idea',async()=>{expect((await getCalendarImageUploadUrl({ideaId:'idea',fileName:'photo.jpg',contentType:'image/jpeg'})).url).toBeTruthy();expect((await getCalendarImageUploadUrl({ideaId:'idea',fileName:'evil.svg',contentType:'image/svg+xml'})).error).toBeTruthy()})
})

it('creates a calendar draft idea with a durable caller id and leaves approvals alone', async()=>{
 h.idea=null;const result=await prepareCalendarUpload(prepare)
 expect(result).toMatchObject({ok:true,ideaId:prepare.ideaId})
 expect(h.writes.find(w=>w.table==='content_ideas').p).toMatchObject({id:prepare.ideaId,client_id:'c',content_type:'P',generated_caption:'Caption',theme:'calendar-upload'})
 expect(h.writes.some(w=>w.p.approval_status)).toBe(false)
})
it('rejects changed upload details on a reused transaction',async()=>{
 h.idea.id=prepare.ideaId;h.metadata.dateTime='2099-10-21T12:00'
 expect((await prepareCalendarUpload(prepare)).error).toMatch(/cambi|otro|detalle/i)
})
it('checks the stored upload size before using it in a post',async()=>{
 storage.send.mockResolvedValue({ContentType:'image/jpeg',ContentLength:2048})
 expect((await finishCalendarUpload(finish)).error).toBeTruthy();expect(remote.create).not.toHaveBeenCalled()
})
