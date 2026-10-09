import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getClientById } from '@/lib/actions/clients'
import { requirePermission } from '@/lib/auth/server'
import { ContentCalendar } from '@/components/published/content-calendar'
export default async function ClientCalendarPage({params}:{params:{id:string}}) {
 await requirePermission('metricool.read')
 const client=await getClientById(params.id)
 if(!client)notFound()
 return <div className="space-y-4"><Link href={`/clients/${client.id}?tab=schedule`} className="text-sm text-muted-foreground hover:text-foreground">← Volver a {client.name}</Link><ContentCalendar clients={[{id:client.id,name:client.name,metricool_blog_id:client.metricool_blog_id,platforms:client.platforms,default_platforms:client.default_platforms}]} clientId={client.id}/></div>
}
