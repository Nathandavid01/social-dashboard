vi.mock('@/lib/context/auth-context',()=>({useAuth:()=>({role:'supervisor'})}))
import {render,screen,fireEvent} from '@testing-library/react'
import {it,expect,vi} from 'vitest'
import {RecordingPending} from './recording-pending'
const h=vi.hoisted(()=>({load:vi.fn()}))
vi.mock('@/lib/actions/recording-pending',()=>({getRecordingPendingTasks:h.load}))
vi.mock('next/navigation',()=>({usePathname:()=>'/recording-calendar'}))
it('shows one badge per session, not per missing requirement',async()=>{
 h.load.mockResolvedValue({month:'2026-09',tasks:[{id:'s',title:'Cliente',date:'2026-09-12',reasons:['Asignar Editor','Faltan 3 Ideas']}]})
 render(<RecordingPending badge/>);expect(await screen.findByLabelText('1 Grabaciones Con Tareas Pendientes Este Mes')).toHaveTextContent('1')
})
it('opens the selected pending session from the checklist',async()=>{
 h.load.mockResolvedValue({month:'2026-09',tasks:[{id:'s',title:'Cliente',date:'2026-09-12',reasons:['Asignar Editor','Faltan 3 Ideas']}]})
 const select=vi.fn();render(<RecordingPending onSelect={select}/>);fireEvent.click(await screen.findByText('Cliente'));expect(select).toHaveBeenCalledWith('s');expect(screen.getByText('Faltan 3 Ideas')).toBeInTheDocument()
})
it('does not display an error as zero pending tasks',async()=>{
 h.load.mockResolvedValue({month:'2026-09',tasks:[],error:'No Se Pudieron Verificar Los Pendientes De Grabación'})
 render(<RecordingPending badge/>);expect(await screen.findByText('!')).toHaveAttribute('title','No Se Pudieron Verificar Los Pendientes De Grabación')
})
