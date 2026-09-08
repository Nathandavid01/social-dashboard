import {expect,it,vi,beforeEach} from 'vitest'
import {render,screen,fireEvent,waitFor} from '@testing-library/react'
const h=vi.hoisted(()=>({load:vi.fn()}))
vi.mock('next/navigation',()=>({useRouter:()=>({refresh:vi.fn()})}))
vi.mock('@/lib/hooks/use-toast',()=>({useToast:()=>({toast:vi.fn()})}))
vi.mock('@/lib/context/auth-context',()=>({useAuth:()=>({user:{id:'u'},role:'supervisor'})}))
vi.mock('@/lib/actions/entregas-review',()=>({getEntregaReviewVideos:h.load}))
vi.mock('@/lib/actions/entregas-r2',()=>({getEntregasPreviewUrl:vi.fn()}))
vi.mock('@/lib/actions/pipeline-submit',()=>({decideReview:vi.fn()}))
vi.mock('@/components/video-analysis/video-analysis-report',()=>({VideoAnalysisReport:()=>null}))
vi.mock('@/components/review/review-queue',()=>({ReviewQueue:({videos}:any)=><div>Queue {videos.map((v:any)=>v.id).join(',')}</div>}))
import {ReviewOverlay} from './review-overlay'
const props={clientId:'c',ideaId:'i',clientName:'Client',onClose:vi.fn()}
beforeEach(()=>h.load.mockReset())
it('recovers after a rejected request without leaving the loading spinner',async()=>{
 h.load.mockRejectedValueOnce(Error('network')).mockResolvedValueOnce({videos:[{id:'i'}]})
 render(<ReviewOverlay {...props}/> )
 expect(await screen.findByRole('alert')).toHaveTextContent('No Se Pudieron Cargar Los Videos')
 expect(screen.queryByText('Cargando videos…')).not.toBeInTheDocument()
 fireEvent.click(screen.getByRole('button',{name:'Volver A Intentar'}))
 expect(await screen.findByText('Queue i')).toBeInTheDocument()
 expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})
it('clears a previous error when opening another video',async()=>{
 h.load.mockResolvedValueOnce({error:'Unavailable'}).mockResolvedValueOnce({videos:[{id:'j'}]})
 const {rerender}=render(<ReviewOverlay {...props}/> )
 await screen.findByText('Unavailable')
 rerender(<ReviewOverlay {...props} ideaId="j"/> )
 expect(await screen.findByText('Queue j')).toBeInTheDocument()
 expect(screen.queryByText('Unavailable')).not.toBeInTheDocument()
})
it('ignores results from a video that was closed',async()=>{
 let resolve:any
 h.load.mockImplementationOnce(()=>new Promise(r=>{resolve=r})).mockResolvedValueOnce({videos:[{id:'j'}]})
 const {rerender}=render(<ReviewOverlay {...props}/> )
 rerender(<ReviewOverlay {...props} ideaId="j"/> )
 await screen.findByText('Queue j')
 resolve({error:'Old error'})
 await waitFor(()=>expect(screen.queryByText('Old error')).not.toBeInTheDocument())
})
