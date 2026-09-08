import {render,screen,fireEvent,waitFor} from '@testing-library/react'
import {it,expect,vi} from 'vitest'
import {PersonalTasks} from './personal-tasks'
const h=vi.hoisted(()=>({load:vi.fn(),assign:vi.fn()}))
vi.mock('@/lib/actions/personal-tasks',()=>({getPersonalTasks:h.load,assignPersonalTask:h.assign,setPersonalTaskStatus:vi.fn()}))
it('allows choosing a person and sends the task with a Puerto Rico deadline',async()=>{
 h.load.mockResolvedValue({tasks:[],people:[{id:'p',full_name:'Carlos'}],canAssign:true,userId:'me'});h.assign.mockResolvedValue({ok:true})
 render(<PersonalTasks/>);fireEvent.click(await screen.findByText('Asignar Tarea'));fireEvent.change(screen.getByLabelText('Persona'),{target:{value:'p'}});fireEvent.change(screen.getByLabelText('Qué Tiene Que Hacer'),{target:{value:'Preparar Ideas'}});fireEvent.change(screen.getByLabelText('Fecha Límite'),{target:{value:'2026-09-09'}});fireEvent.click(screen.getByText('Guardar Asignación'))
 await waitFor(()=>expect(h.assign).toHaveBeenCalledWith(expect.objectContaining({assignee_id:'p',title:'Preparar Ideas',due_at:'2026-09-09T17:00:00-04:00'})))
})
it('shows personal work without assignment controls for a regular user',async()=>{
 h.load.mockResolvedValue({tasks:[{id:'t',title:'Editar Reel',description:'Añadir captions',assignee_id:'me',status:'pending',priority:1,due_at:null}],people:[],canAssign:false,userId:'me'})
 render(<PersonalTasks/>);expect(await screen.findByText('Editar Reel')).toBeInTheDocument();expect(screen.queryByText('Asignar Tarea')).not.toBeInTheDocument()
})
