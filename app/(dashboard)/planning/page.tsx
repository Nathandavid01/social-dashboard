import { Suspense } from 'react'
import { PageHeader } from '@/components/shared/page-header'
import { WorkflowBoard } from '@/components/planning/workflow-board'
import { PageSpinner } from '@/components/shared/page-spinner'
import { getWorkflowProgress } from '@/lib/utils/workflow-progress'
import { getIdeacionPipeline } from '@/lib/actions/content-ideas'
import { getMetricoolPicturesByBlogId } from '@/lib/actions/client-pictures'
import { resolveInterval } from '@/lib/utils/recording-window'
import { resolveClientLogo } from '@/lib/utils/client-logo'
import { createClient } from '@/lib/supabase/server'
import type { Client, Profile } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function WorkflowData() {
  const supabase = await createClient()

  const [{ rows }, ideas, { data: clients }, { data: profiles }, intervalRes, metricoolPics] = await Promise.all([
    getWorkflowProgress(),
    getIdeacionPipeline({ limit: 300 }),
    supabase
      .from('clients')
      .select('id, name, industry, logo_url, metricool_blog_id, brand_voice, caption_language, default_cta, default_hashtags, caption_notes')
      .eq('status', 'active')
      .order('name'),
    supabase.from('profiles').select('id, full_name').order('full_name'),
    // Resilient: this column may not exist yet (migration 0029). On error the
    // query returns { data: null } and every client falls back to the default.
    supabase.from('clients').select('id, recording_interval_weeks').eq('status', 'active'),
    // Brand pictures from Metricool ({} when not configured → falls back to initials).
    getMetricoolPicturesByBlogId(),
  ])

  const clientRows = (clients ?? []) as Client[]

  const intervalByClient: Record<string, number> = {}
  for (const r of (intervalRes?.data ?? []) as { id: string; recording_interval_weeks: number | null }[]) {
    intervalByClient[r.id] = resolveInterval(r.recording_interval_weeks)
  }

  // Effective logo per client: uploaded logo_url first, else the Metricool brand picture.
  const logoByClient: Record<string, string | null> = {}
  for (const c of clientRows) {
    const pic = c.metricool_blog_id ? metricoolPics[String(c.metricool_blog_id)] : undefined
    logoByClient[c.id] = resolveClientLogo(c.logo_url, pic)
  }

  return (
    <WorkflowBoard
      clients={rows}
      initialIdeas={ideas}
      profiles={(profiles ?? []) as Pick<Profile, 'id' | 'full_name'>[]}
      clientList={clientRows}
      intervalByClient={intervalByClient}
      logoByClient={logoByClient}
    />
  )
}

export default function PlanningPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Workflow"
        description="Cada cliente con sus videos: genera ideas, edita fechas de grabación/publicación, sigue el flujo y asígnalas a producción (individual o en lote)."
      />
      <Suspense fallback={<div className="grid h-64 place-items-center"><PageSpinner /></div>}>
        <WorkflowData />
      </Suspense>
    </div>
  )
}
