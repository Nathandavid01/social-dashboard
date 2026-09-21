vi.mock('@/lib/context/auth-context',()=>({useAuth:()=>({role:'supervisor'})}))
import {render,screen,fireEvent} from '@testing-library/react'
import {it,expect,vi} from 'vitest'
import {RecordingPending} from './recording-pending'
const h=vi.hoisted(()=>({load:vi.fn(),hoy:vi.fn()}))
vi.mock('@/lib/actions/recording-pending',()=>({getRecordingPendingTasks:h.load}))
vi.mock('@/lib/actions/recording-hoy-gaps',()=>({getRecordingHoyGaps:h.hoy}))
vi.mock('next/navigation',()=>({usePathname:()=>'/recording-calendar'}))
it('badge counts actionable gaps, not the monthly prep total',async()=>{
 h.hoy.mockResolvedValue({visible:true,actionableCount:2,actionableIds:['a','b'],unconfirmed:[{id:'a'}],sinVideo:[{id:'b'}],ideasShortfall:Array.from({length:40},(_,i)=>({id:`i${i}`}))})
 render(<RecordingPending badge/>);expect(await screen.findByLabelText('2 grabaciones por atender')).toHaveTextContent('2')
 expect(h.load).not.toHaveBeenCalled()
})
it('opens the selected pending session from the checklist',async()=>{
 h.load.mockResolvedValue({month:'2026-09',tasks:[{id:'s',title:'Cliente',date:'2026-09-12',reasons:['Asignar Editor','Faltan 3 Ideas']}]})
 const select=vi.fn();render(<RecordingPending onSelect={select}/>);fireEvent.click(await screen.findByText('Cliente'));expect(select).toHaveBeenCalledWith('s');expect(screen.getByText('Faltan 3 Ideas')).toBeInTheDocument()
})
it('does not display an error as zero pending tasks',async()=>{
 h.hoy.mockResolvedValue({visible:true,actionableCount:0,actionableIds:[],unconfirmed:[],sinVideo:[],ideasShortfall:[],error:'No se pudieron verificar los huecos de grabación'})
 render(<RecordingPending badge/>);expect(await screen.findByText('!')).toHaveAttribute('title','No se pudieron verificar los huecos de grabación')
})
