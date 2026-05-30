import { Suspense } from 'react'
import { PageHeader } from '@/components/shared/page-header'
import { PlanningBoard } from '@/components/planning/planning-board'
import { NateLoader } from '@/components/shared/nate-loader'
import { getWorkflowProgress } from '@/lib/utils/workflow-progress'
import { getPipelineTotals } from '@/lib/utils/content-pipeline'
import { getMetricoolWeeklyPostsByClient } from '@/lib/utils/metricool-weekly'
import { createClient } from '@/lib/supabase/server'
import type { ScheduleTask, ScheduleIdeaFields } from '@/components/planning/client-schedule'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function PlanningData() {
  const supabase = await createClient()
  const today = new Date()
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 14)
  const todayStr = today.toISOString().slice(0, 10)
  const endStr = end.toISOString().slice(0, 10)

  const [{ rows }, pipeline, postedByClient, { data: tasks }] = await Promise.all([
    getWorkflowProgress(),
    getPipelineTotals(),
    getMetricoolWeeklyPostsByClient(),
    supabase
      .from('production_tasks')
      .select('client_id, publish_date, idea_id, content_type')
      .gte('publish_date', todayStr)
      .lte('publish_date', endStr),
  ])

  const ideaIds = Array.from(new Set((tasks ?? []).map((t) => t.idea_id).filter(Boolean))) as string[]
  const ideaMap = new Map<string, { title: string } & ScheduleIdeaFields>()
  if (ideaIds.length) {
    const { data: ideas } = await supabase
      .from('content_ideas')
      .select('id, title, generated_caption, hook, visual_brief, status, approval_status, published_at, recording_session_id, recording_date')
      .in('id', ideaIds)
    for (const i of ideas ?? []) {
      ideaMap.set(i.id, i as unknown as { title: string } & ScheduleIdeaFields)
    }
  }

  const schedulesByClient: Record<string, ScheduleTask[]> = {}
  for (const t of tasks ?? []) {
    const idea = t.idea_id ? ideaMap.get(t.idea_id) : null
    ;(schedulesByClient[t.client_id] ??= []).push({
      publishDate: t.publish_date,
      ideaId: t.idea_id,
      ideaTitle: idea?.title ?? null,
      contentType: t.content_type,
      hasCaption: !!idea?.generated_caption,
      idea: idea ?? null,
    })
  }

  const pipelines = Object.fromEntries(pipeline.perClient.map((p) => [p.clientId, p]))
  return (
    <PlanningBoard
      rows={rows}
      pipelines={pipelines}
      postedByClient={postedByClient}
      schedulesByClient={schedulesByClient}
    />
  )
}

export default function PlanningPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Planning"
        description="Primero, ideación: cada cliente debe tener ideas listas al menos un mes por adelantado según su cadencia. Luego se agendan las grabaciones. Hasta que todos estén listos, este trabajo sigue abierto."
      />
      <Suspense fallback={<div className="grid h-64 place-items-center"><NateLoader variant="inline" label="Calculando estado…" /></div>}>
        <PlanningData />
      </Suspense>
    </div>
  )
}
