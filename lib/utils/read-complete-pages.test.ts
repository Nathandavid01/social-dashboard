import {expect,it,vi} from 'vitest'
import {readCompletePages} from './read-complete-pages'
it('reads until the exact count is reached',async()=>{
 const read=vi.fn().mockResolvedValueOnce({data:[{id:'a'}],count:2}).mockResolvedValueOnce({data:[{id:'b'}],count:2})
 expect(await readCompletePages(read)).toEqual([{id:'a'},{id:'b'}])
 expect(read).toHaveBeenNthCalledWith(2,1,500)
})
it.each([
 [{data:null,error:{message:'offline'}}],
 [{data:[],count:null}],
 [{data:[],count:1}],
 [{data:[{id:'a'}],count:2},{data:[{id:'a'}],count:2}],
 [{data:[{id:'a'}],count:2},{data:[{id:'b'}],count:3}],
])('rejects incomplete or changing results',async (...responses)=>{
 await expect(readCompletePages(async()=>responses.shift() as any)).rejects.toThrow()
})
