import { RoleGate } from '@/components/auth/role-gate'
import { requirePermission } from '@/lib/auth/server'
import { createClient } from '@/lib/supabase/server'
import { PublicationAuditPanel } from '@/components/published/publication-audit-panel'
import { PublishedPageClient } from '@/components/published/published-page-client'

export const dynamic = 'force-dynamic'

export default async function PublishedPage() {
  await requirePermission('metricool.read')
  const supabase = await createClient()
  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, metricool_blog_id')
    .not('metricool_blog_id', 'is', null)
    .eq('status', 'active')
    .order('name')

  return <div className="space-y-5"><div className="p-4 sm:p-6"><RoleGate perm="metricool.read"><PublicationAuditPanel /></RoleGate></div><PublishedPageClient clients={clients ?? []} /></div>
}
