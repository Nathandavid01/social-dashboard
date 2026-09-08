vi.mock('next/navigation',()=>({useRouter:()=>({refresh:vi.fn()})}))
import {render,screen,fireEvent,waitFor} from '@testing-library/react'
import {it,expect,vi} from 'vitest'
import {RecordingEditors} from './recording-editors'
const h=vi.hoisted(()=>({save:vi.fn(async()=>({ok:true})),setup:vi.fn(async()=>({clientId:'c',clients:[{id:'c',name:'Cliente',assigned_to:'a'}],editors:[{id:'a',full_name:'Alexa'},{id:'b',full_name:'Carlos'}],links:[{client_id:'c',editor_id:'a'}]}))}))
vi.mock('@/lib/actions/recording-editors',()=>({getRecordingEditorSetup:h.setup,saveRecordingEditors:h.save}))
it('preserves the existing editor and adds another editor to the same client',async()=>{render(<RecordingEditors sessionId="s" onSaved={()=>{}}/>);fireEvent.click(await screen.findByLabelText('Carlos'));fireEvent.click(screen.getByText('Guardar Editores'));await waitFor(()=>expect(h.save).toHaveBeenCalledWith('s','c',['a','b']))})
