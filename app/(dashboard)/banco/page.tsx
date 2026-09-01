import { requirePermission } from '@/lib/auth/server'
import { createClient } from '@/lib/supabase/server'
import { getIdeacionPipeline } from '@/lib/actions/content-ideas'
import { getMetricoolPicturesByBlogId } from '@/lib/actions/client-pictures'
import { resolveClientLogo } from '@/lib/utils/client-logo'
import { buildVideoBank } from '@/lib/pipeline/video-bank'
import { projectPostingCalendar, type ClientQueueInput } from '@/lib/pipeline/projected-calendar'
import { editorApprovalStats, editorWipLimitFor } from '@/lib/pipeline/editor-wip'
import { clientAssigneeId } from '@/lib/pipeline/editor-video-bank'
import { buildClientCalendar } from '@/lib/pipeline/client-calendar'
import { planNextVideoSlot } from '@/lib/utils/planned-sessions'
import { getActivityLog } from '@/lib/actions/activity'
import { BancoView, type BancoClientPanel, type BancoDevuelto, type BancoEditorStat } from '@/components/banco/banco-view'
import type { IdeaWithPipeline } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Banco de Video — biblioteca global de crudos, SOLO admins (owner/supervisor).
 * Los demás roles ni lo ven en el menú ni pueden entrar (500 limpio).
 */
const ACTIVITY_ES: Record<string, string> = {
  created: 'Creó',
  status_changed: 'Movió',
  published: 'Publicó',
  approved: 'Aprobó',
  submitted: 'Entregó',
  revision_requested: 'Pidió revisión de',
  caption_saved: 'Guardó caption de',
  video_uploaded: 'Subió video de',
  reassigned: 'Reasignó',
}

function describeActivity(action: string, ideaTitle: string | null): string {
  const verb = ACTIVITY_ES[action] ?? action
  return ideaTitle ? `${verb} "${ideaTitle}"` : verb
}

export default async function BancoPage() {
  await requirePermission('video_bank.read')
  const supabase = await createClient()

  const [ideas, { data: clientsRaw }, metricoolPics, { data: teamProfiles }, activity] = await Promise.all([
    getIdeacionPipeline({ limit: 400 }),
    supabase
      .from('clients')
      .select('id, name, logo_url, posting_days, posting_time, posting_schedule, metricool_blog_id, assigned_to')
      .eq('status', 'active')
      .order('name'),
    getMetricoolPicturesByBlogId(),
    supabase.from('profiles').select('id, full_name, email, role, status').eq('status', 'active'),
    getActivityLog({ limit: 300 }),
  ])

  const clients = clientsRaw ?? []
  const profiles = teamProfiles ?? []
  const names: Record<string, string> = Object.fromEntries(
    profiles.map((p) => [p.id, p.full_name?.trim() || p.email || 'Sin nombre']),
  )

  const bank = buildVideoBank(ideas, { editorNames: names, recorderNames: names })

  const devueltos: BancoDevuelto[] = ideas
    .filter((i) => i.approval_status === 'revision_needed' && i.status !== 'descartada')
    .map((i) => ({
      ideaId: i.id,
      title: i.title?.trim() || i.hook?.trim() || 'Sin título',
      clientName: i.client?.name ?? 'Cliente',
      editorName: i.assignee?.full_name ?? names[clientAssigneeId(i) ?? ''] ?? null,
    }))

  const ideasByClient = new Map<string, IdeaWithPipeline[]>()
  for (const idea of ideas) {
    const key = idea.client?.id ?? idea.client_id
    if (!key) continue
    const list = ideasByClient.get(key) ?? []
    list.push(idea)
    ideasByClient.set(key, list)
  }
  const queueInputs: ClientQueueInput[] = clients.map((c) => ({
    clientId: c.id,
    clientName: c.name,
    postingDays: (c.posting_days ?? []) as number[],
    postingTime: c.posting_time ?? null,
    postingSchedule: (c.posting_schedule ?? null) as Record<string, string> | null,
    ideas: ideasByClient.get(c.id) ?? [],
  }))
  const calendar = projectPostingCalendar(queueInputs, { from: new Date(), days: 14 })

  const teamEditors = profiles
    .filter((p) => p.role === 'editor')
    .map((p) => ({ id: p.id, name: names[p.id] }))

  const queueCountByEditor = new Map<string, number>()
  for (const rail of bank.rails) {
    for (const tile of rail.videos) {
      if (tile.editorId) queueCountByEditor.set(tile.editorId, (queueCountByEditor.get(tile.editorId) ?? 0) + 1)
    }
  }
  const editors: BancoEditorStat[] = teamEditors.map((ed) => {
    const stats = editorApprovalStats(ideas, ed.id)
    return {
      id: ed.id,
      name: ed.name,
      wipLimit: editorWipLimitFor(stats),
      approved: stats.approved,
      returned: stats.returned,
      queueCount: queueCountByEditor.get(ed.id) ?? 0,
    }
  })

  // Sección Clientes: calendario de crudos/editados, cuándo agendar, mini-CRM.
  const today = new Date()
  const clientsPanel: BancoClientPanel[] = clients.map((c) => {
    const postingDays = (c.posting_days ?? []) as number[]
    const latest = activity
      .filter((a) => a.client?.id === c.id)
      .slice(0, 5)
      .map((a) => ({
        when: a.created_at,
        who: (a as { user?: { full_name?: string | null } | null }).user?.full_name ?? null,
        text: describeActivity(
          a.action,
          (a as { idea?: { title?: string | null } | null }).idea?.title ?? null,
        ),
      }))
    return {
      clientId: c.id,
      clientName: c.name,
      nextSlotLabel: planNextVideoSlot(postingDays, today)?.label ?? null,
      calendar: buildClientCalendar(ideas, c.id, { from: today, days: 14, postingDays }),
      latest,
    }
  })

  const clientLogos: Record<string, string | null> = Object.fromEntries(
    clients.map((c) => {
      const metricoolPic = c.metricool_blog_id ? metricoolPics[String(c.metricool_blog_id)] : undefined
      return [c.id, resolveClientLogo(c.logo_url, metricoolPic)]
    }),
  )

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-border px-4 py-3">
        <h1 className="text-lg font-semibold">Banco de Video</h1>
        <p className="text-[12px] text-muted-foreground">
          Crudos pendientes de todos los clientes — solo carátulas, para ir rápido. Lo aprobado vive en la pestaña Calendario.
        </p>
      </header>
      <BancoView
        bank={bank}
        calendar={calendar}
        devueltos={devueltos}
        editors={editors}
        teamEditors={teamEditors}
        clientLogos={clientLogos}
        clientsPanel={clientsPanel}
      />
    </div>
  )
}
