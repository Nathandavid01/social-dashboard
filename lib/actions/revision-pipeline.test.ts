import { beforeEach, expect, it, vi } from 'vitest'
const h = vi.hoisted(() => ({ replies: [] as any[], ranges: [] as number[][] }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ from: () => {
  const q: any = { select: () => q, order: () => q, eq: () => q, limit: () => q,
    range: (a: number, b: number) => { h.ranges.push([a,b]); return q },
    then: (resolve: any) => Promise.resolve(h.replies.shift()).then(resolve) }
  return q
} }) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
import { getIdeacionPipeline } from './content-ideas'
beforeEach(() => { h.replies = []; h.ranges = [] })
it('loads older review videos beyond the first page', async () => {
 h.replies = [{data: Array.from({length:500},(_,i)=>({id:String(i)})),count:501}, {data:[{id:'older'}],count:501}]
 const rows = await getIdeacionPipeline({ complete: true })
 expect(rows).toHaveLength(501)
 expect(rows.at(-1)?.id).toBe('older')
 expect(h.ranges).toEqual([[0,499],[500,999]])
})
it.each([
 [{data:null,error:{message:'offline'}}],
 [{data:[],count:null}],
 [{data:[{id:'one'}],count:2},{data:[],count:2}],
])('rejects failed or incomplete review reads', async (...replies) => {
 h.replies = replies
 await expect(getIdeacionPipeline({complete:true})).rejects.toThrow()
})

it('rejects a count change during pagination',async()=>{
 h.replies=[{data:[{id:'a'}],count:501},{data:[{id:'b'}],count:500}]
 await expect(getIdeacionPipeline({complete:true})).rejects.toThrow('cambió')
})
it('rejects duplicate rows across pages',async()=>{
 h.replies=[{data:[{id:'a'}],count:2},{data:[{id:'a'}],count:2}]
 await expect(getIdeacionPipeline({complete:true})).rejects.toThrow('cambió')
})
it('accepts a verified empty queue',async()=>{
 h.replies=[{data:[],count:0}]
 await expect(getIdeacionPipeline({complete:true})).resolves.toEqual([])
})
