import {beforeEach,expect,it,vi} from 'vitest'
import {render,screen,fireEvent} from '@testing-library/react'
const h=vi.hoisted(()=>({load:vi.fn(),create:vi.fn()}))
vi.mock('@/lib/hooks/use-toast',()=>({useToast:()=>({toast:vi.fn()})}))
vi.mock('@/lib/actions/entregas-client-review',()=>({getEnlaceCliente:h.load,crearEnlaceCliente:h.create}))
vi.mock('@/lib/actions/entregas-r2',()=>({getEntregaVideoEditado:async()=>({id:'v'}),getEntregasDownloadUrl:vi.fn()}))
import {EnlaceClienteBoton} from './enlace-cliente-boton'
beforeEach(()=>{h.load.mockReset();h.create.mockReset()})
it.each(['returned','rejected'])('does not offer link creation after a %s read failure',async failure=>{
 if(failure==='returned')h.load.mockResolvedValueOnce({error:'offline'})
 else h.load.mockRejectedValueOnce(Error('offline'))
 h.load.mockResolvedValueOnce({enlace:{token:'token',videos:[]}})
 render(<EnlaceClienteBoton clientId="c" clientName="Client" ideaId="i"/> )
 expect(await screen.findByRole('alert')).toHaveTextContent('No Se Pudo Cargar El Enlace')
 fireEvent.click(screen.getByRole('button',{name:'Reintentar Enlace'}))
 expect(await screen.findByRole('link',{name:'Abrir lo que ve Client en su enlace de aprobación'})).toHaveAttribute('href','/aprobacion/token')
 expect(h.create).not.toHaveBeenCalled()
})
