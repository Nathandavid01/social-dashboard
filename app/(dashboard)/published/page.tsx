import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/shared/page-header'
import { PublishedFeed } from '@/components/published/published-feed'

export default async function PublishedPage() {
  const supabase = await createClient()
  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, metricool_blog_id')
    .not('metricool_blog_id', 'is', null)
    .eq('status', 'active')
    .order('name')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Posts Publicados"
        description="Todo el contenido publicado y programado en Metricool"
      />
      <PublishedFeed clients={clients ?? []} />
    </div>
  )
}
