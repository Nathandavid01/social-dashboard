import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useReciboProjection } from './use-calendar-projection'
import type { IdeaWithPipeline } from '@/lib/supabase/types'
const client = {id:'c',metricool_blog_id:'1',posting_days:[1,3,5],posting_time:'10:00'}
const ideas: IdeaWithPipeline[]=[]
const response=(posts:unknown[]=[])=>({ok:true,json:async()=>({posts,complete:true})})
const post={id:1,uuid:'u',clientId:'c',blogId:'1',publicationDate:'2027-02-01T10:00:00',timezone:'America/Puerto_Rico',draft:true,platforms:[],media:[]}
afterEach(()=>{cleanup();vi.unstubAllGlobals()})
it('rejects an aborted old-client response after switching accounts',async()=>{
 let finish:(value:unknown)=>void=()=>{}
 const fetcher=vi.fn().mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve})).mockResolvedValue(response())
 vi.stubGlobal('fetch',fetcher)
 const {result,rerender}=renderHook(({account})=>useReciboProjection(ideas,account,'2026-10-18T12:00:00',0),{initialProps:{account:client}})
 rerender({account:{...client,id:'other',metricool_blog_id:'2'}})
 await waitFor(()=>expect(result.current.projection).not.toBeNull())
 expect(result.current.projection?.through).toBeNull()
 await act(async()=>finish(response([post])))
 expect(result.current.projection?.through).toBeNull()
 expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true)
})
it('marks cached results as verifying and clears them after refresh fails',async()=>{
 const fetcher=vi.fn().mockResolvedValue(response([post]))
 vi.stubGlobal('fetch',fetcher)
 const {result,rerender}=renderHook(({refresh})=>useReciboProjection(ideas,client,'2026-10-18T12:00:00',refresh),{initialProps:{refresh:0}})
 await waitFor(()=>expect(result.current.projection?.through).toBe('2027-02-01'))
 let fail:()=>void=()=>{}
 fetcher.mockImplementation(()=>new Promise((_,reject)=>{fail=()=>reject(Error('offline'))}))
 rerender({refresh:1})
 expect(result.current.verifying).toBe(true)
 await act(async()=>fail())
 expect(result.current.projection).toBeNull()
 expect(result.current.error).toMatch(/No se pudo verificar/)
})
it('does not fetch or claim dates without a connected client account',()=>{
 const fetcher=vi.fn()
 vi.stubGlobal('fetch',fetcher)
 const {result}=renderHook(()=>useReciboProjection(ideas,{...client,metricool_blog_id:null},'2026-10-18T12:00:00',0))
 expect(fetcher).not.toHaveBeenCalled()
 expect(result.current.projection).toBeNull()
 expect(result.current.verifying).toBe(false)
})
