import {beforeEach,expect,it,vi} from 'vitest'
const h=vi.hoisted(()=>({ideas:[] as any[],media:[] as any[],fail:'',writes:[] as string[]}))
vi.mock('next/cache',()=>({revalidatePath:vi.fn()}))
vi.mock('@/lib/auth/server',()=>({requirePermission:async()=>{}}))
vi.mock('@/lib/supabase/server',()=>({createClient:async()=>({auth:{getUser:async()=>({data:{user:{id:'u'}}})},from:(table:string)=>{
 let write=''
 const result=()=>h.fail===table?{data:null,error:{message:'offline'}}:{data:write?(table==='entregas_client_reviews'?{id:'r',token:'token'}:[]):table==='content_ideas'?h.ideas:table==='content_idea_videos'?h.media:[]}
 const q:any={select:()=>q,in:()=>q,eq:()=>q,neq:()=>q,insert:()=>{write='insert';h.writes.push(table);return q},delete:()=>{write='delete';h.writes.push(table);return q},single:async()=>result(),then:(resolve:any)=>Promise.resolve(result()).then(resolve)};return q
}})}))
import {crearEnlaceCliente} from './entregas-client-review'
beforeEach(()=>{h.ideas=[{id:'i',client_id:'c',status:'producida'}];h.media=[{idea_id:'i',status:'ready'}];h.fail='';h.writes=[]})
it.each(['content_ideas','content_idea_videos','entregas_client_review_items'])('does not mutate when %s cannot be verified',async table=>{
 h.fail=table
 expect((await crearEnlaceCliente({clientId:'c',ideaIds:['i']})).error).toBeTruthy()
 expect(h.writes).toEqual([])
})
it('rejects a video belonging to a different client',async()=>{
 h.ideas[0].client_id='other'
 expect((await crearEnlaceCliente({clientId:'c',ideaIds:['i']})).error).toBeTruthy()
 expect(h.writes).toEqual([])
})
it.each(['failed','archived'])('rejects %s edited files',async status=>{
 h.media[0].status=status
 expect((await crearEnlaceCliente({clientId:'c',ideaIds:['i']})).error).toBeTruthy()
 expect(h.writes).toEqual([])
})
it('does not silently omit a requested video without media',async()=>{
 h.ideas.push({id:'j',client_id:'c',status:'producida'})
 expect((await crearEnlaceCliente({clientId:'c',ideaIds:['i','j']})).error).toBeTruthy()
 expect(h.writes).toEqual([])
})
it('rejects discarded ideas',async()=>{
 h.ideas[0].status='descartada'
 expect((await crearEnlaceCliente({clientId:'c',ideaIds:['i']})).error).toBeTruthy()
 expect(h.writes).toEqual([])
})
it('creates a link after validating all requested videos',async()=>{
 expect(await crearEnlaceCliente({clientId:'c',ideaIds:['i','i']})).toEqual({token:'token'})
 expect(h.writes).toEqual(['entregas_client_reviews','entregas_client_review_items'])
})
