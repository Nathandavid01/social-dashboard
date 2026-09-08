import {beforeEach,expect,it,vi} from 'vitest'
import {render,screen,fireEvent,waitFor} from '@testing-library/react'
const h=vi.hoisted(()=>({vote:vi.fn(),read:vi.fn()}))
vi.mock('@/lib/actions/entregas-client-review',()=>({votarRevisionPublica:h.vote,getRevisionPublica:h.read}))
import {AprobacionCliente} from './aprobacion-cliente'
const revision:any={clientName:'Client',expiresAt:'2099-09-15',videos:[{ideaId:'i',titulo:'Video',status:'pending',videoUrl:'https://example.com/video.mp4'}]}
function setup(){render(<AprobacionCliente revision={revision} token="token" nowISO="2026-09-08"/>)}
beforeEach(()=>{h.vote.mockReset();h.read.mockReset()})
it('keeps the comment and verifies an uncertain submission before allowing another vote',async()=>{
 h.vote.mockRejectedValueOnce(Error('network'))
 h.read.mockResolvedValueOnce({...revision,videos:[{...revision.videos[0],status:'rejected'}]})
 setup()
 fireEvent.change(screen.getByRole('textbox',{name:/Recomendaciones/}),{target:{value:'Cortar el final'}})
 fireEvent.click(screen.getByRole('button',{name:'No aprobar'}))
 expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos confirmar')
 expect(screen.getByRole('textbox',{name:/Recomendaciones/})).toHaveValue('Cortar el final')
 expect(screen.getByRole('button',{name:'No aprobar'})).toBeDisabled()
 fireEvent.click(screen.getByRole('button',{name:'Consultar Mi Respuesta'}))
 expect(await screen.findByText('Recibido. Le pasamos tus comentarios al editor.')).toBeInTheDocument()
 expect(h.vote).toHaveBeenCalledTimes(1)
})
it('does not show success for an empty action response',async()=>{
 h.vote.mockResolvedValueOnce({})
 setup();fireEvent.loadedData(document.querySelector('video')!);fireEvent.click(screen.getByRole('button',{name:'Aprobar'}))
 expect(await screen.findByRole('alert')).toBeInTheDocument()
 expect(screen.queryByText('¡Gracias! Ya nos llegó tu aprobación.')).not.toBeInTheDocument()
})
it('unlocks voting only after confirming that no answer was stored',async()=>{
 h.vote.mockRejectedValueOnce(Error('network'));h.read.mockResolvedValueOnce(revision)
 setup();fireEvent.loadedData(document.querySelector('video')!);fireEvent.click(screen.getByRole('button',{name:'Aprobar'}))
 fireEvent.click(await screen.findByRole('button',{name:'Consultar Mi Respuesta'}))
 await waitFor(()=>expect(screen.getByRole('button',{name:'Aprobar'})).toBeEnabled())
 expect(h.vote).toHaveBeenCalledTimes(1)
})
it('keeps voting locked if the verification request also fails',async()=>{
 h.vote.mockRejectedValueOnce(Error('network'));h.read.mockRejectedValueOnce(Error('network'))
 setup();fireEvent.loadedData(document.querySelector('video')!);fireEvent.click(screen.getByRole('button',{name:'Aprobar'}))
 fireEvent.click(await screen.findByRole('button',{name:'Consultar Mi Respuesta'}))
 await waitFor(()=>expect(screen.getByRole('button',{name:'Consultar Mi Respuesta'})).toBeEnabled())
 expect(screen.getByRole('button',{name:'Aprobar'})).toBeDisabled()
})

it('keeps approval disabled until video data loads',()=>{
 setup()
 expect(screen.getByRole('button',{name:'Aprobar'})).toBeDisabled()
 expect(h.vote).not.toHaveBeenCalled()
})
it('does not allow approval for a missing video',()=>{
 render(<AprobacionCliente revision={{...revision,videos:[{...revision.videos[0],videoUrl:null}]}} token="token" nowISO="2026-09-08"/> )
 expect(screen.getByRole('button',{name:'Aprobar'})).toBeDisabled()
})
it('blocks approval after playback error but lets the client report the problem',async()=>{
 h.vote.mockResolvedValueOnce({ok:true})
 setup()
 const media=document.querySelector('video')!
 fireEvent.loadedData(media)
 expect(screen.getByRole('button',{name:'Aprobar'})).toBeEnabled()
 fireEvent.error(media)
 expect(screen.getByRole('button',{name:'Aprobar'})).toBeDisabled()
 expect(screen.getByRole('alert')).toHaveTextContent('No se pudo reproducir')
 fireEvent.change(screen.getByRole('textbox',{name:/Recomendaciones/}),{target:{value:'El video no reproduce'}})
 fireEvent.click(screen.getByRole('button',{name:'No aprobar'}))
 expect(await screen.findByText('Recibido. Le pasamos tus comentarios al editor.')).toBeInTheDocument()
 expect(h.vote).toHaveBeenCalledWith(expect.objectContaining({decision:'rejected',comment:'El video no reproduce'}))
})
