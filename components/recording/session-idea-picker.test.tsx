import {it,expect,vi} from 'vitest'
import {render,screen,fireEvent} from '@testing-library/react'
vi.mock('next/navigation',()=>({useRouter:()=>({refresh:vi.fn()})}))
vi.mock('@/lib/actions/onsite',()=>({getAddableIdeas:async()=>({ideas:[{id:'a',title:'Idea Aprobada',source:'lab'},{id:'b',title:'Idea Escrita',source:'pipeline'}]}),addIdeaToSession:vi.fn(async()=>({ok:true}))}))
import {SessionIdeaPicker} from './session-idea-picker'
it('offers existing ideas by source and searches titles',async()=>{render(<SessionIdeaPicker sessionId="s" onAdded={()=>{}}/>);expect(await screen.findByText('Idea Aprobada')).toBeInTheDocument();expect(screen.getByText('Lab De Ideas')).toBeInTheDocument();fireEvent.change(screen.getByPlaceholderText('Buscar Ideas Del Cliente'),{target:{value:'Escrita'}});expect(screen.queryByText('Idea Aprobada')).not.toBeInTheDocument();expect(screen.getByText('Idea Escrita')).toBeInTheDocument()})
