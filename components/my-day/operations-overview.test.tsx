vi.mock('./workflow-refresh',()=>({WorkflowRefresh:()=>null}))
import { vi } from 'vitest'
vi.mock('./publication-checklist',()=>({PublicationChecklist:()=>null}))
import {it,expect} from 'vitest'
import {render,screen} from '@testing-library/react'
import {OperationsOverviewView} from './operations-overview'
import {buildOperationsOverview} from '@/lib/utils/operations-overview'
it('shows an operational checklist and honest empty scheduling state',()=>{
 const data=buildOperationsOverview([],[{id:'c',name:'Arasibo',posting_days:[2],metricool_blog_id:null}],[{id:'e',full_name:'Alexa',role:'editor',status:'active'}],'2026-09-08')
 render(<OperationsOverviewView data={data}/> )
 expect(screen.getByRole('heading',{name:'Mi Día'})).toBeInTheDocument()
 expect(screen.getByText('Falta Preparar El Video De Hoy')).toBeInTheDocument()
 expect(screen.getByText('Alexa')).toBeInTheDocument()
 expect(screen.getByText(/2 espacios por llenar/)).toBeInTheDocument()
 expect(screen.getByText(/No hay videos listos para agendar/)).toBeInTheDocument()
 expect(screen.getByRole('link',{name:/Verificar En Metricool/})).toHaveAttribute('href','/published')
})
