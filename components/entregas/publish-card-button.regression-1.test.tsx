import {beforeEach,expect,it,vi} from 'vitest'
import {render,screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
const h=vi.hoisted(()=>({send:vi.fn(),toast:vi.fn()}))
vi.mock('@/lib/actions/idea-posting',()=>({publishIdeaToMetricool:h.send}))
vi.mock('@/lib/hooks/use-toast',()=>({useToast:()=>({toast:h.toast})}))
vi.mock('@/components/auth/role-gate',()=>({useHasPermission:()=>true}))
vi.mock('next/navigation',()=>({useRouter:()=>({refresh:vi.fn()})}))
import {PublishCardButton} from './publish-card-button'
beforeEach(()=>{h.send.mockReset();h.toast.mockReset()})
it('exits busy state and reports a transport failure while processing other videos',async()=>{
 h.send.mockRejectedValueOnce(new Error('Network failed')).mockResolvedValueOnce({ok:true})
 render(<PublishCardButton ideaIds={['one','two']}/> )
 await userEvent.click(screen.getByRole('button'))
 expect(await screen.findByRole('button',{name:/Enviar a Metricool/})).toBeEnabled()
 expect(h.send).toHaveBeenCalledTimes(2)
 expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({variant:'destructive'}))
 expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({title:'1 video enviado a Metricool'}))
})
it('does not count an empty server result as a successful post',async()=>{
 h.send.mockResolvedValue({})
 render(<PublishCardButton ideaIds={['one']}/> )
 await userEvent.click(screen.getByRole('button'))
 expect(h.toast).not.toHaveBeenCalledWith(expect.objectContaining({title:'1 video enviado a Metricool'}))
 expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({variant:'destructive'}))
})
