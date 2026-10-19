import { render, screen, cleanup, act, fireEvent, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const {draft,send,hide}=vi.hoisted(()=>({draft:vi.fn(),send:vi.fn(),hide:vi.fn()}))
vi.mock('@/lib/actions/recibo-calendar-draft',()=>({draftReciboOnDate:draft}))
vi.mock('@/lib/actions/recibo-calendar-send',()=>({sendReciboOnDate:send}))
vi.mock('@/lib/actions/recibo-calendar-hide',()=>({setReciboCalendarHidden:hide}))
vi.mock('next/navigation',()=>({useRouter:()=>({refresh:vi.fn()})}))
vi.mock('@/components/auth/role-gate',()=>({useHasPermission:()=>true}))
vi.mock('@/lib/actions/client-cadence',()=>({updateClientCadence:vi.fn()}))
vi.mock('@/lib/published/calendar-post',async importOriginal=>({...await importOriginal<object>(),puertoRicoNow:()=> '2026-10-16T20:00:00'}))
vi.mock('@/components/recibo/recibo-video-preview',()=>({ReciboVideoPreview:({ideaId}:{ideaId:string})=><video data-testid={`preview-${ideaId}`}/>}))
import { ContentCalendar } from './content-calendar'
import type { IdeaWithPipeline } from '@/lib/supabase/types'
const client={id:'c',name:'643 Sport Bar',metricool_blog_id:'1',posting_days:[0,1,2,3,4,5,6],posting_time:'23:00'}
const idea={id:'i',client_id:'c',title:'Pasta',status:'producida',staff_client_approval:'approved',client:{id:'c',name:'643',industry:'restaurant',edit_mode:'ai'},videos:[{id:'v',kind:'edited',status:'uploaded',name:'pasta.mp4',storage_provider:'entregas-r2',drive_file_id:'file'}]} as IdeaWithPipeline
beforeEach(()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({posts:[],complete:true})}));send.mockReset();hide.mockReset();draft.mockReset()})
afterEach(()=>{cleanup();vi.unstubAllGlobals()})

// Eric 2026-10-19: «quiero poder enviar desde aquí».
it('sends an approved card only after confirming its date, time and automatic publication',async()=>{
 send.mockResolvedValue({ok:true,confirmed:true,scheduledFor:'2026-10-16T23:00'})
 render(<ContentCalendar clients={[client]} clientId="c" projectionIdeas={[idea]} />)
 const card=(await screen.findByTestId('preview-i')).closest('article')!
 fireEvent.click(within(card).getByRole('button',{name:'Enviar a Metricool'}))
 expect(send).not.toHaveBeenCalled()
 const dialog=screen.getByRole('dialog')
 expect(within(dialog).getByText(/se publicará automáticamente/i)).toBeInTheDocument()
 expect(within(dialog).getByText(/23:00/)).toBeInTheDocument()
 expect(within(dialog).getByLabelText('Fecha de publicación')).toHaveValue('2026-10-16')
 await act(async()=>{fireEvent.click(within(dialog).getByRole('button',{name:'Programar publicación'}))})
 expect(send).toHaveBeenCalledTimes(1)
 expect(send).toHaveBeenCalledWith({ideaId:'i',clientId:'c',videoId:'v',date:'2026-10-16'})
 expect(draft).not.toHaveBeenCalled()
 expect(screen.queryByTestId('preview-i')).toBeNull()
 expect(screen.getByText(/Programado en Metricool para el 2026-10-16 · 23:00/)).toBeInTheDocument()
})
it('explains a draft that could not be scheduled and does not resend it',async()=>{
 send.mockResolvedValue({draftOnly:true,error:'Se creó el borrador, pero no se programó: algo. Prográmalo desde el borrador en el calendario.'})
 render(<ContentCalendar clients={[client]} clientId="c" projectionIdeas={[idea]} />)
 fireEvent.click(await screen.findByRole('button',{name:'Enviar a Metricool'}))
 await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Programar publicación'}))})
 expect(screen.getByText(/Se creó el borrador, pero no se programó/)).toBeInTheDocument()
 expect(screen.queryByTestId('preview-i')).toBeNull()
 expect(send).toHaveBeenCalledTimes(1)
})
it('keeps the piece and its error when sending is rejected',async()=>{
 send.mockResolvedValue({error:'Cambió el archivo editado.'})
 render(<ContentCalendar clients={[client]} clientId="c" projectionIdeas={[idea]} />)
 fireEvent.click(await screen.findByRole('button',{name:'Enviar a Metricool'}))
 await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Programar publicación'}))})
 expect(screen.getByText('Cambió el archivo editado.')).toBeInTheDocument()
 expect(screen.getByTestId('preview-i')).toBeInTheDocument()
})
it('does not offer sending for pieces pending approval',async()=>{
 render(<ContentCalendar clients={[client]} clientId="c" projectionIdeas={[{...idea,staff_client_approval:null}]} />)
 await screen.findByTestId('preview-i')
 expect(screen.queryByRole('button',{name:'Enviar a Metricool'})).toBeNull()
})

// Eric 2026-10-19: «borrar los posts del calendario pero que se queden en el banco, no quiero que cuenten».
it('removes a piece from the calendar and its counts, and can put it back',async()=>{
 hide.mockResolvedValue({ok:true})
 render(<ContentCalendar clients={[client]} clientId="c" projectionIdeas={[idea]} />)
 const card=(await screen.findByTestId('preview-i')).closest('article')!
 expect(card.closest('[data-calendar-date]')).not.toBeNull()
 expect(screen.getByText(/1 pieza pendiente/)).toBeInTheDocument()
 await act(async()=>{fireEvent.click(within(card).getByRole('button',{name:'Quitar del calendario'}))})
 expect(hide).toHaveBeenCalledWith({ideaId:'i',clientId:'c',hidden:true})
 expect(await screen.findByText(/0 piezas pendientes/)).toBeInTheDocument()
 const removed=screen.getByRole('region',{name:'Fuera del calendario'})
 expect(within(removed).getByTestId('preview-i').closest('[data-calendar-date]')).toBeNull()
 expect(within(removed).getByText(/Siguen en Recibo/)).toBeInTheDocument()
 await act(async()=>{fireEvent.click(within(removed).getByRole('button',{name:'Volver al calendario'}))})
 expect(hide).toHaveBeenLastCalledWith({ideaId:'i',clientId:'c',hidden:false})
 expect(await screen.findByText(/1 pieza pendiente/)).toBeInTheDocument()
 expect(screen.queryByRole('region',{name:'Fuera del calendario'})).toBeNull()
})
it('shows pieces already removed apart, outside the counts',async()=>{
 render(<ContentCalendar clients={[client]} clientId="c" projectionIdeas={[{...idea,calendar_hidden_at:'2026-10-19T00:00:00Z'}]} />)
 expect(await screen.findByText(/0 piezas pendientes/)).toBeInTheDocument()
 expect(within(screen.getByRole('region',{name:'Fuera del calendario'})).getByTestId('preview-i')).toBeInTheDocument()
})
it('keeps the piece on the calendar when removing fails',async()=>{
 hide.mockResolvedValue({error:'Falta aplicar la migración 0091 en la base de datos.'})
 render(<ContentCalendar clients={[client]} clientId="c" projectionIdeas={[idea]} />)
 const remove=await screen.findByRole('button',{name:'Quitar del calendario'})
 await act(async()=>{fireEvent.click(remove)})
 expect(screen.getByText(/migración 0091/)).toBeInTheDocument()
 expect(screen.getByTestId('preview-i').closest('[data-calendar-date]')).not.toBeNull()
})
