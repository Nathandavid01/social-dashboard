import { createClient } from '@/lib/supabase/server'
import { PublishedPageClient } from '@/components/published/published-page-client'

export const dynamic = 'force-dynamic'

export default async function PublishedPage() {
  const supabase = await createClient()
  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, metricool_blog_id')
    .not('metricool_blog_id', 'is', null)
    .eq('status', 'active')
    .order('name')

  return <PublishedPageClient clients={clients ?? []} />
}
