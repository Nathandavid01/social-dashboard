import { it, expect, vi } from 'vitest'
import { render,screen } from '@testing-library/react'
const h=vi.hoisted(()=>({permission:vi.fn(async()=>{}),client:vi.fn(async()=>({id:'c',name:'Cliente A',metricool_blog_id:'1',platforms:['instagram']}))}))
vi.mock('@/lib/auth/server',()=>({requirePermission:h.permission}))
vi.mock('@/lib/actions/clients',()=>({getClientById:h.client}))
vi.mock('@/components/published/content-calendar',()=>({ContentCalendar:({clients,clientId}:any)=><div data-testid="client-calendar">{clientId} · {clients[0].name}</div>}))
import Page from './page'
it('gates access and passes exactly the selected client to the full calendar',async()=>{render(await Page({params:{id:'c'}}));expect(h.permission).toHaveBeenCalledWith('metricool.read');expect(screen.getByTestId('client-calendar')).toHaveTextContent('c · Cliente A')})
