import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/shared/page-header'
import { IdeacionBoard } from '@/components/ideas/ideacion-board'
import { getContentIdeas } from '@/lib/actions/content-ideas'
import type { Client, Profile } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

export default async function IdeacionPage() {
  const supabase = await createClient()

  const [ideas, { data: clients }, { data: profiles }] = await Promise.all([
    getContentIdeas({ limit: 200 }),
    supabase
      .from('clients')
      .select('id, name, industry, metricool_blog_id, brand_voice, caption_language, default_cta, default_hashtags, caption_notes')
      .eq('status', 'active')
      .order('name'),
    supabase.from('profiles').select('id, full_name').order('full_name'),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ideación"
        description="Genera ideas de contenido con IA, asígnalas a producción"
      />
      <IdeacionBoard
        initialIdeas={ideas}
        clients={(clients ?? []) as Client[]}
        profiles={(profiles ?? []) as Pick<Profile, 'id' | 'full_name'>[]}
      />
    </div>
  )
}
