import { render, screen, waitFor, cleanup } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
vi.mock('@/components/auth/role-gate',()=>({useHasPermission:()=>true}))
vi.mock('@/lib/actions/client-cadence',()=>({updateClientCadence:vi.fn()}))
vi.mock('@/lib/published/calendar-post',async importOriginal=>({...await importOriginal<object>(),puertoRicoNow:()=> '2026-10-16T20:00:00'}))
vi.mock('@/components/recibo/recibo-video-preview',()=>({ReciboVideoPreview:({ideaId}:{ideaId:string})=><video controls data-testid={`preview-${ideaId}`}/>}))
import { ContentCalendar } from './content-calendar'
import type { IdeaWithPipeline } from '@/lib/supabase/types'
afterEach(()=>{cleanup();vi.unstubAllGlobals()})
const client={id:'c',name:'Yabuuchi',metricool_blog_id:'1',posting_days:[0,1,2,3,4,5,6],posting_time:'23:00'}
const idea={id:'i',client_id:'c',title:'La Jefa',status:'producida',videos:[{id:'v',kind:'edited',status:'uploaded',name:'jefa.mp4',storage_provider:'entregas-r2',drive_file_id:'file'}]} as IdeaWithPipeline
it('shows an actual player in its projected date and opens on this week',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({posts:[],checkedAt:'2026-10-17T00:00:00Z',complete:true})}))
 const {container}=render(<ContentCalendar clients={[client]} clientId="c" projectionIdeas={[idea]} />)
 await screen.findByTestId('preview-i')
 expect(container.querySelector('[data-calendar-date]')).toHaveAttribute('data-calendar-date','2026-10-11')
 expect(screen.getByTestId('preview-i').closest('[data-calendar-date]')).toHaveAttribute('data-calendar-date','2026-10-16')
 expect(screen.getByText(/Cobertura proyectada hasta/)).toBeInTheDocument()
 expect(screen.getByText('Proyectado · pendiente de aprobación')).toBeInTheDocument()
})
it('does not present unverified dates as coverage after a Metricool failure',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false}))
 render(<ContentCalendar clients={[client]} clientId="c" projectionIdeas={[idea]} />)
 await waitFor(()=>expect(screen.getByRole('alert')).toBeInTheDocument())
 expect(screen.queryByTestId('preview-i')).toBeNull()
 expect(screen.queryByText(/Cobertura proyectada hasta/)).toBeNull()
})
