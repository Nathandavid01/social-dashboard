import {useState} from 'react'
import {afterEach,it,expect} from 'vitest'
import {render,screen,cleanup} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {ReciboWorkspace} from './recibo-workspace'
afterEach(cleanup)
it('opens the posting calendar in Recibos and keeps received content accessible',async()=>{
 render(<ReciboWorkspace calendar={<div>Calendario conectado</div>}><div>Videos recibidos</div></ReciboWorkspace>)
 expect(screen.getByRole('tab',{name:'Calendario'})).toHaveAttribute('aria-selected','true')
 expect(screen.getByText('Calendario conectado')).toBeVisible()
 await userEvent.click(screen.getByRole('tab',{name:'Contenido recibido'}))
 expect(screen.getByText('Videos recibidos')).toBeVisible()
 await userEvent.click(screen.getByRole('tab',{name:'Calendario'}))
 expect(screen.getByText('Calendario conectado')).toBeVisible()
})
it('keeps the received-content board available without Metricool access',()=>{
 render(<ReciboWorkspace calendar={null}><div>Videos recibidos</div></ReciboWorkspace>)
 expect(screen.getByText('Videos recibidos')).toBeVisible();expect(screen.queryByRole('tab')).toBeNull()
})

it('keeps a pending upload mounted when switching to received content',async()=>{
 function Pending(){const [caption,setCaption]=useState('');return <input aria-label="Caption pendiente" value={caption} onChange={e=>setCaption(e.target.value)}/>}
 render(<ReciboWorkspace calendar={<Pending/>}><div>Recibidos</div></ReciboWorkspace>);await userEvent.type(screen.getByLabelText('Caption pendiente'),'Subida pendiente');await userEvent.click(screen.getByRole('tab',{name:'Contenido recibido'}));await userEvent.click(screen.getByRole('tab',{name:'Calendario'}));expect(screen.getByLabelText('Caption pendiente')).toHaveValue('Subida pendiente')
})
