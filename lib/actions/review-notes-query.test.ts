import { expect, it, vi } from 'vitest'
import { getCompleteReviewNotes } from './review-notes-query'
function db(replies: any[]) {
 const ranges = vi.fn()
 const client: any = {from:()=>{const q:any={select:()=>q,in:()=>q,order:()=>q,range:(a:number,b:number)=>{ranges(a,b);return q},then:(resolve:any)=>Promise.resolve(replies.shift()).then(resolve)};return q}}
 return {client,ranges}
}
const note=(id:string,idea=id)=>({id,content_idea_id:idea,metadata:{note:`Fix ${id}`},created_at:'2026-09-08',user:null})
it('includes corrections beyond the first 500 history rows',async()=>{
 const {client,ranges}=db([{data:Array.from({length:500},(_,i)=>note(String(i),'a')),count:501},{data:[note('older','b')],count:501}])
 const result=await getCompleteReviewNotes(client,['a','b'])
 expect(result.b.note).toBe('Fix older')
 expect(ranges).toHaveBeenCalledWith(500,999)
})
it('does not query an empty set',async()=>{
 const client:any={from:vi.fn()}
 expect(await getCompleteReviewNotes(client,[])).toEqual({})
 expect(client.from).not.toHaveBeenCalled()
})
it.each([
 [{data:null,error:{message:'offline'}}],
 [{data:[],count:null}],
 [{data:[note('a')],count:2},{data:[],count:2}],
 [{data:[note('a')],count:2},{data:[note('a')],count:2}],
 [{data:[note('a')],count:2},{data:[note('b')],count:3}],
])('rejects incomplete history',async (...replies)=>{
 await expect(getCompleteReviewNotes(db(replies).client,['a'])).rejects.toThrow()
})
it('chunks large client-visible sets without repeating ids',async()=>{
 const {client,ranges}=db([{data:[],count:0},{data:[],count:0}])
 await getCompleteReviewNotes(client,[...Array.from({length:101},(_,i)=>String(i)),'0'])
 expect(ranges).toHaveBeenCalledTimes(2)
})
