import {afterEach,expect,it,vi} from 'vitest'
import {checkVideoPlayable} from './video-health'
afterEach(()=>vi.restoreAllMocks())
it('bounds the probe and reports an aborted connection as a normal failure',async()=>{
 const controller=new AbortController()
 const timeout=vi.spyOn(AbortSignal,'timeout').mockReturnValue(controller.signal)
 const fetch=vi.fn(async(_url:any,init:any)=>{expect(init.signal).toBe(controller.signal);throw new DOMException('Timed out','TimeoutError')})
 expect(await checkVideoPlayable('https://media.example/video.mp4',fetch)).toMatchObject({ok:false})
 expect(timeout).toHaveBeenCalledWith(10000)
})
