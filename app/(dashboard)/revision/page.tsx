import { requirePermission, getEffectiveRole, getEffectiveUserId, currentUserHas } from '@/lib/auth/server'
import { getIdeacionPipeline } from '@/lib/actions/content-ideas'
import { createClient } from '@/lib/supabase/server'
import { clientsForUser, visibleClientIds } from '@/lib/utils/client-visibility'
import { filterEntregasDeliveredIdeas } from '@/lib/utils/entregas-delivery'
import { EntregasBoard } from '@/components/entregas/entregas-board'
import { getCompleteReviewNotes } from '@/lib/actions/review-notes-query'
import { VistaEditor } from '@/components/entregas/vista-editor'
import { SupervisorProcessSteps } from '@/components/onsite/supervisor-process-steps'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Revisión — la primera mitad del flujo del editor: entregar y revisar.
 *
 * La segunda mitad (copy y publicación) vive en /entregas. Un video cruza de
 * una pantalla a la otra al aprobarse; son la misma tabla vista por etapas
 * distintas, no dos flujos.
 */
export default async function RevisionPage() {
  await requirePermission('revision.read')
  try {
    const supabase = await createClient()

    const [ideas, clientsResult, role, userId, showProcess] = await Promise.all([
      getIdeacionPipeline({ complete: true }),
      supabase.from('clients').select('id, name, assigned_to, assigned_designer, posting_time, posting_days').eq('status', 'active').order('name'),
      getEffectiveRole(),
      getEffectiveUserId(),
      currentUserHas('recording.brief'),
    ])

    if (clientsResult.error) throw new Error('No se pudieron cargar los clientes.')
    const activeClients = clientsResult.data ?? []

    // Solo lo entregado por este flujo: edited file on Entregas R2 (not pipeline r2).
    // Without this filter, historical ideas without Entregas uploads pollute the board.
    const entregados = filterEntregasDeliveredIdeas(ideas)

    // El tablero también se acota: filtrar solo el desplegable dejaba al editor
    // viendo el trabajo de los demás, que no puede tocar y le estorba para ver
    // el suyo.
    const asignables = activeClients.map((c) => ({ id: c.id, name: c.name, assigned_to: c.assigned_to ?? null, assigned_designer: c.assigned_designer ?? null }))
    const permitidos = visibleClientIds(role, userId, asignables)
    const mios = permitidos === null
      ? entregados
      : entregados.filter((i) => permitidos.has(i.client_id ?? ''))

    // El desplegable solo ofrece lo que esta persona trabaja. Filtro de
    // conveniencia — ver la nota en client-visibility.ts; no es control de acceso.
    const submitClients = clientsForUser(
      role,
      userId,
      asignables,
    ).map((c) => ({
      id: c.id,
      name: c.name,
      postingDays: activeClients.find((a) => a.id === c.id)?.posting_days ?? [],
    }))

    // Las correcciones de la última ronda, para enseñarlas en la tarjeta que
    // volvió al editor. Solo de lo visible: no hace falta traerlas todas.
    const devueltos = mios.filter((i) => i.approval_status === 'revision_needed').map((i) => i.id)
    const reviewNotes = await getCompleteReviewNotes(supabase, devueltos)

    // El editor y el diseñador solo entregan: no reparten trabajo del equipo, así
    // que las pestañas de día y el selector de semana les sobran. Y la fecha ya
    // la dice cada video, con lo que la pestaña tampoco decidía nada.
    if (role === 'editor' || role === 'disenador') {
      return (
        <VistaEditor
          submitClients={submitClients}
          devueltos={mios
            .filter((i) => i.approval_status === 'revision_needed')
            .map((i) => ({
              id: i.id,
              titulo: i.title?.trim() || i.hook?.trim() || 'Sin título',
              clientName: i.client?.name ?? 'Sin cliente',
              nota: reviewNotes[i.id] ?? null,
            }))}
        />
      )
    }

    return (
      <div className="space-y-4">
        {showProcess && <SupervisorProcessSteps pathname="/revision" />}
        <EntregasBoard
          ideas={mios}
          reviewNotes={reviewNotes}
          allClients={activeClients.map((c) => ({ id: c.id, name: c.name }))}
          submitClients={submitClients}
          stages={['edited', 'approval']}
          postingTimes={Object.fromEntries(activeClients.map((c) => [c.id, c.posting_time ?? null]))}
        />
      </div>
    )
  } catch {
    return <section role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
      <h1 className="font-semibold">No Se Pudo Cargar Revisión</h1>
      <p className="mt-2 text-sm">No pudimos verificar la cola completa, los clientes o las correcciones. Esto no significa que no haya videos pendientes.</p>
      <a href="/revision" className="mt-4 inline-flex min-h-11 items-center rounded-lg border px-4 text-sm font-medium">Volver A Cargar Revisión</a>
    </section>
  }

}
