import { render, screen, waitFor, cleanup, act, fireEvent, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
const {draft}=vi.hoisted(()=>({draft:vi.fn()}))
vi.mock('@/lib/actions/recibo-calendar-draft',()=>({draftReciboOnDate:draft}))
vi.mock('next/navigation',()=>({useRouter:()=>({refresh:vi.fn()})}))
vi.mock('@/components/auth/role-gate',()=>({useHasPermission:()=>true}))
vi.mock('@/lib/actions/client-cadence',()=>({updateClientCadence:vi.fn()}))
vi.mock('@/lib/published/calendar-post',async importOriginal=>({...await importOriginal<object>(),puertoRicoNow:()=> '2026-10-16T20:00:00'}))
vi.mock('@/components/recibo/recibo-video-preview',()=>({ReciboVideoPreview:({ideaId,image,title}:{ideaId:string;image?:boolean;title?:string})=>image?<img alt={title} data-testid={`image-${ideaId}`}/>:<video controls data-testid={`preview-${ideaId}`}/>}))
import { ContentCalendar } from './content-calendar'
import type { IdeaWithPipeline } from '@/lib/supabase/types'
afterEach(()=>{cleanup();vi.useRealTimers();vi.unstubAllGlobals()})
const client={id:'c',name:'Yabuuchi',metricool_blog_id:'1',posting_days:[0,1,2,3,4,5,6],posting_time:'23:00'}
const idea={id:'i',client_id:'c',title:'La Jefa',status:'producida',client:{id:'c',name:'Yabuuchi',industry:'restaurant',edit_mode:'ai'},videos:[{id:'v',kind:'edited',status:'uploaded',name:'jefa.mp4',storage_provider:'entregas-r2',drive_file_id:'file'}]} as IdeaWithPipeline
it('shows an actual player in its projected date and opens on this week',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({posts:[],checkedAt:'2026-10-17T00:00:00Z',complete:true})}))
 const {container}=render(<ContentCalendar clients={[client]} clientId="c" projectionIdeas={[idea]} />)
 await screen.findByTestId('preview-i')
 expect(container.querySelector('[data-calendar-date]')).toHaveAttribute('data-calendar-date','2026-10-11')
 expect(screen.getByTestId('preview-i').closest('[data-calendar-date]')).toHaveAttribute('data-calendar-date','2026-10-16')
 expect(screen.getByText(/Contenido actual hasta el/)).toBeInTheDocument()
 expect(screen.getByText('Proyectado · pendiente de aprobación')).toBeInTheDocument()
})
it('does not present unverified dates as coverage after a Metricool failure',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false}))
 render(<ContentCalendar clients={[client]} clientId="c" projectionIdeas={[idea]} />)
 await waitFor(()=>expect(screen.getByRole('alert')).toBeInTheDocument())
 expect(screen.queryByTestId('preview-i')).toBeNull()
 expect(screen.queryByText(/Contenido actual hasta el/)).toBeNull()
})
it('uses Recibo approval and never the Revisión seal for projected cards',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({posts:[],checkedAt:'now',complete:true})}))
 render(<ContentCalendar clients={[client]} clientId="c" projectionIdeas={[{...idea,approval_status:'approved',approved_video_id:'v'},{...idea,id:'approved',staff_client_approval:'approved'}]} />)
 await screen.findByTestId('preview-i')
 expect(screen.getByText('Proyectado · pendiente de aprobación')).toBeInTheDocument()
 expect(screen.getByText('Proyectado · aprobado')).toBeInTheDocument()
})
it('keeps visible calendar posts when the separate coverage query fails',async()=>{
 const fetcher=vi.fn(async (url:string)=>({ok:!url.includes('startDate=2026-10-16'),json:async()=>({complete:true,checkedAt:'now',posts:[{id:1,text:'Publicación programada existente',publicationDate:'2026-10-17T11:00:00',timezone:'America/Puerto_Rico',platforms:['instagram'],providerStatuses:['PENDING'],media:[],blogId:'1',clientId:'c',draft:false}]})}))
 vi.stubGlobal('fetch',fetcher)
 render(<ContentCalendar clients={[client]} clientId="c" projectionIdeas={[idea]} />)
 await screen.findAllByText('Publicación programada existente')
 expect(await screen.findByText(/No se pudo verificar la cobertura/)).toBeInTheDocument()
 expect(screen.queryByTestId('preview-i')).toBeNull()
 for(const [url] of fetcher.mock.calls){const p=new URL(url,'http://localhost').searchParams;expect((Date.parse(p.get('endDate')!)-Date.parse(p.get('startDate')!))/86400000).toBeLessThan(40)}
})
// Eric, 2026-10-18: coverage now includes future drafts/scheduled posts after the pending queue ends.
it('verifies a full year in bounded batches even after all queued videos fit',async()=>{
 const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>({posts:[],checkedAt:'now',complete:true})})
 vi.stubGlobal('fetch',fetcher)
 const queue=Array.from({length:50},(_,i)=>({...idea,id:`piece-${i}`}))
 render(<ContentCalendar clients={[client]} clientId="c" projectionIdeas={queue} />)
 await screen.findByText(/50 piezas pendientes/)
 expect(screen.getByText(/Contenido actual hasta el/)).toHaveTextContent('4 de diciembre de 2026')
 expect(fetcher).toHaveBeenCalledTimes(12)
 expect(fetcher.mock.calls[1][0]).toContain('startDate=2026-10-16')
 expect(fetcher.mock.calls[2][0]).toContain('startDate=2026-11-20')
})

it('keeps playable coverage visible while the minute refresh is pending',async()=>{
 vi.useFakeTimers()
 let refreshing=false
 const fetcher=vi.fn().mockImplementation(()=>refreshing?new Promise(()=>{}):Promise.resolve({ok:true,json:async()=>({posts:[],complete:true,checkedAt:'now'})}))
 vi.stubGlobal('fetch',fetcher)
 await act(async()=>{render(<ContentCalendar clients={[client]} clientId="c" projectionIdeas={[idea]} />)})
 expect(screen.getByTestId('preview-i')).toBeInTheDocument()
 refreshing=true
 await act(async()=>{vi.advanceTimersByTime(60000)})
 expect(fetcher).toHaveBeenCalledTimes(14)
 expect(screen.getByTestId('preview-i')).toBeInTheDocument()
 expect(screen.getByText('Verificando hasta qué día llega tu contenido…')).toBeInTheDocument()
 expect(screen.queryByText(/Contenido actual hasta el/)).toBeNull()
})

it('shows pending graphics as images without dates when cadence is unconfigured',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({posts:[],complete:true,checkedAt:'now'})}))
 const graphic={...idea,id:'graphic',title:'Pizza 643',videos:[{...idea.videos![0],id:'png',name:'pizza.png',mime_type:'image/png'}]}
 render(<ContentCalendar clients={[{...client,posting_days:[]}]} clientId="c" projectionIdeas={[graphic]} />)
 expect(await screen.findByTestId('image-graphic')).toHaveAttribute('alt','Pizza 643')
 expect(screen.getByTestId('image-graphic').closest('[data-calendar-date]')).toBeNull()
 expect(screen.getByText('Sin fecha · 1 pieza')).toBeInTheDocument()
 expect(screen.getByText(/1 pieza pendiente/)).toBeInTheDocument()
})

it('dragging an approved projection creates an exact-day draft once and removes its suggestion',async()=>{
 draft.mockReset();let finish:(value:unknown)=>void=()=>{};draft.mockImplementation(()=>new Promise(resolve=>{finish=resolve}))
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({posts:[],complete:true})}))
 const {container}=render(<ContentCalendar clients={[client]} clientId="c" projectionIdeas={[{...idea,staff_client_approval:'approved'}]} />)
 const card=(await screen.findByTestId('preview-i')).closest('article')!
 expect(card).toHaveAttribute('draggable','true')
 const transfer={setData:vi.fn(),getData:()=>JSON.stringify({ideaId:'i',clientId:'c',videoId:'v'}),types:['application/x-nate-recibo']}
 fireEvent.dragStart(card,{dataTransfer:transfer})
 const day=container.querySelector('[data-calendar-date="2026-10-20"]')!
 fireEvent.drop(day,{dataTransfer:transfer});fireEvent.drop(day,{dataTransfer:transfer})
 expect(draft).toHaveBeenCalledTimes(1)
 expect(draft).toHaveBeenCalledWith({ideaId:'i',clientId:'c',videoId:'v',date:'2026-10-20'})
 await act(async()=>finish({ok:true}))
 expect(screen.queryByTestId('preview-i')).toBeNull()
 expect(screen.getByText(/Borrador creado/)).toBeInTheDocument()
})
it('pending approval cannot be dragged and has an explanation',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({posts:[],complete:true})}))
 render(<ContentCalendar clients={[client]} clientId="c" projectionIdeas={[idea]} />)
 expect((await screen.findByTestId('preview-i')).closest('article')).toHaveAttribute('draggable','false')
 expect(screen.getByText(/Aprueba en Recibo para crear/)).toBeInTheDocument()
})
it('lets touch and keyboard users choose a date, retaining the piece on unconfirmed failure',async()=>{
 draft.mockReset().mockResolvedValue({error:'No se confirmó. Verifica Metricool.'})
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({posts:[],complete:true})}))
 render(<ContentCalendar clients={[client]} clientId="c" projectionIdeas={[{...idea,staff_client_approval:'approved'}]} />)
 fireEvent.click(await screen.findByRole('button',{name:'Elegir fecha de borrador'}))
 fireEvent.change(screen.getByLabelText('Fecha del borrador'),{target:{value:'2026-10-21'}})
 fireEvent.click(screen.getByRole('button',{name:'Crear borrador'}))
 await screen.findByText('No se confirmó. Verifica Metricool.')
 expect(draft).toHaveBeenCalledWith({ideaId:'i',clientId:'c',videoId:'v',date:'2026-10-21'})
 expect(screen.getByTestId('preview-i')).toBeInTheDocument()
 expect(draft).toHaveBeenCalledTimes(1)
})
it('ignores foreign transfers and past date drops',async()=>{
 draft.mockReset()
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({posts:[],complete:true})}))
 const {container}=render(<ContentCalendar clients={[client]} clientId="c" projectionIdeas={[{...idea,staff_client_approval:'approved'}]} />)
 const card=(await screen.findByTestId('preview-i')).closest('article')!
 fireEvent.drop(container.querySelector('[data-calendar-date="2026-10-20"]')!,{dataTransfer:{getData:()=>'{"ideaId":"foreign"}'}})
 fireEvent.dragStart(card,{dataTransfer:{setData:vi.fn()}})
 fireEvent.drop(container.querySelector('[data-calendar-date="2026-10-12"]')!)
 expect(draft).not.toHaveBeenCalled()
})

it('shows the last existing draft date with no pending ideas, even outside the visible month',async()=>{
 const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>({posts:[{id:1,uuid:'u',blogId:'1',clientId:'c',text:'Draft',publicationDate:'2027-02-10T11:00:00',timezone:'America/Puerto_Rico',draft:true,media:[],platforms:[]}],complete:true})})
 vi.stubGlobal('fetch',fetcher)
 const {container}=render(<ContentCalendar clients={[client]} clientId="c" projectionIdeas={[]} />)
 expect(await screen.findByText(/Contenido actual hasta el/)).toHaveTextContent('10 de febrero de 2027')
 expect(screen.getByText(/1 borrador/)).toBeInTheDocument()
 fireEvent.click(screen.getByRole('button',{name:'Ver última fecha'}))
 await waitFor(()=>expect(container.querySelector('[data-calendar-date="2027-02-10"]')).toBeInTheDocument())
})
it('does not expose a date when a later verification chunk is incomplete',async()=>{
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>({ok:true,json:async()=>({posts:[],complete:!url.includes('startDate=2026-12-25')})})))
 render(<ContentCalendar clients={[client]} clientId="c" projectionIdeas={[idea]} />)
 expect(await screen.findByText(/No se pudo verificar la cobertura/)).toBeInTheDocument()
 expect(screen.queryByText(/Contenido actual hasta el/)).toBeNull()
})

// Eric, 2026-10-18: every pending calendar card identifies its actual format separately from approval.
it('labels projected graphics Post and videos Reel on their own cards',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({posts:[],complete:true})}))
 const graphic={...idea,id:'graphic',title:'Pizza 643',videos:[{...idea.videos![0],id:'png',name:'pizza.png',mime_type:'image/png'}]}
 render(<ContentCalendar clients={[client]} clientId="c" projectionIdeas={[graphic,idea]} />)
 const postCard=(await screen.findByTestId('image-graphic')).closest('article')!
 const reelCard=(await screen.findByTestId('preview-i')).closest('article')!
 expect(within(postCard).getByText('Post',{exact:true})).toBeVisible()
 expect(within(reelCard).getByText('Reel',{exact:true})).toBeVisible()
 expect(within(postCard).getByText('Proyectado · pendiente de aprobación')).toBeInTheDocument()
 expect(within(reelCard).getByText('Proyectado · pendiente de aprobación')).toBeInTheDocument()
})
it('keeps a single explicit format badge on undated cards',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({posts:[],complete:true})}))
 render(<ContentCalendar clients={[{...client,posting_days:[]}]} clientId="c" projectionIdeas={[idea]} />)
 const card=(await screen.findByTestId('preview-i')).closest('article')!
 expect(within(card).getAllByText('Reel',{exact:true})).toHaveLength(1)
 expect(within(card).getByText('Pendiente de aprobación',{exact:true})).toBeInTheDocument()
})

it.each(['human','unknown','legacy-r2'])('keeps %s content visible without unsupported drafting controls',async kind=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({posts:[],complete:true})}))
 const unsupported={...idea,staff_client_approval:'approved',client:kind==='unknown'?undefined:{edit_mode:kind==='human'?'human':'ai'},videos:idea.videos!.map(v=>({...v,storage_provider:kind==='legacy-r2'?'r2':v.storage_provider}))} as IdeaWithPipeline
 render(<ContentCalendar clients={[client]} clientId="c" projectionIdeas={[unsupported]} />)
 const card=(await screen.findByTestId('preview-i')).closest('article')!
 expect(card).toHaveAttribute('draggable','false')
 expect(within(card).queryByRole('button',{name:'Elegir fecha de borrador'})).toBeNull()
 expect(within(card).getByText(/Borrador desde calendario no disponible/)).toBeInTheDocument()
})
