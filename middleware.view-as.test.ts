import {beforeEach,expect,it,vi} from 'vitest'
const target='a16752e4-05d1-42e3-812c-28a1afb5752c'
const h=vi.hoisted(()=>({real:{} as any,target:{} as any}))
vi.mock('@supabase/ssr',()=>({createServerClient:()=>({auth:{getUser:async()=>({data:{user:{id:'real'}}})},from:()=>{
 let id='';const q:any={select:()=>q,eq:(_k:string,v:string)=>{id=v;return q},single:async()=>({data:id==='real'?h.real:h.target,error:null}),maybeSingle:async()=>({data:id==='real'?h.real:h.target,error:null})};return q
}})}))
vi.mock('next/server',()=>({NextResponse:{next:()=>({kind:'next',cookies:{getAll:()=>[],set:vi.fn()}}),redirect:(url:URL)=>({kind:'redirect',url:url.toString(),cookies:{set:vi.fn()}})}}))
import {middleware} from './middleware'
beforeEach(()=>{h.real={role:'owner',area_access:null};h.target={role:'supervisor',status:'active',approval_status:'approved',area_access:null}})
const request=(path='/onsite')=>({cookies:{getAll:()=>[],get:()=>({value:target}),set:vi.fn()},nextUrl:{pathname:path,clone:()=>new URL('http://localhost'+path)}} as any)
it('lets an owner viewing a supervisor open On Site',async()=>{
 expect(await middleware(request())).toMatchObject({kind:'next'})
})
it('uses the target area restrictions instead of the owner areas',async()=>{
 h.target.area_access=['/clients']
 expect(await middleware(request())).toMatchObject({kind:'redirect'})
})
it('still denies On Site to an editor target',async()=>{
 h.target.role='editor'
 expect(await middleware(request())).toMatchObject({kind:'redirect'})
})
it('ignores an invalid target as the server does',async()=>{
 h.target.status='inactive'
 expect(await middleware(request())).toMatchObject({kind:'next'})
})
it('does not let a supervisor inherit an owner target',async()=>{
 h.real={role:'supervisor',area_access:[]};h.target.role='owner'
 expect(await middleware(request('/clients'))).toMatchObject({kind:'redirect'})
})
it('ignores a forged view-as cookie from an editor',async()=>{
 h.real.role='editor'
 expect(await middleware(request())).toMatchObject({kind:'redirect'})
})
