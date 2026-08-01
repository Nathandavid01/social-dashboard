import { requirePermission, getCurrentRole } from '@/lib/auth/server'
import { getIdeacionPipeline } from '@/lib/actions/content-ideas'
import { createClient } from '@/lib/supabase/server'
import { clientsForUser, visibleClientIds } from '@/lib/utils/client-visibility'
import { EntregasBoard } from '@/components/entregas/entregas-board'
import { latestNoteByIdea, type ReviewNoteRow } from '@/lib/actions/review-notes-core'

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
  const supabase = await createClient()

  const [ideas, { data: activeClientsRaw }, role, { data: { user } }] = await Promise.all([
    getIdeacionPipeline({ limit: 400 }),
    supabase.from('clients').select('id, name, assigned_to, assigned_designer, posting_time').eq('status', 'active').order('name'),
    getCurrentRole(),
    supabase.auth.getUser(),
  ])

  const activeClients = activeClientsRaw ?? []

  // Solo lo entregado por este flujo: un video con su archivo ya en R2. Sin
  // esto heredaría las ideas históricas, que nunca pasaron por aquí.
  const entregados = ideas.filter((i) =>
    (i.videos ?? []).some((v) => v.kind === 'edited' && v.storage_provider === 'entregas-r2'),
  )

  // El tablero también se acota: filtrar solo el desplegable dejaba al editor
  // viendo el trabajo de los demás, que no puede tocar y le estorba para ver
  // el suyo.
  const asignables = activeClients.map((c) => ({ id: c.id, name: c.name, assigned_to: c.assigned_to ?? null, assigned_designer: c.assigned_designer ?? null }))
  const permitidos = visibleClientIds(role, user?.id ?? null, asignables)
  const mios = permitidos === null
    ? entregados
    : entregados.filter((i) => permitidos.has(i.client_id ?? ''))

  // El desplegable solo ofrece lo que esta persona trabaja. Filtro de
  // conveniencia — ver la nota en client-visibility.ts; no es control de acceso.
  const submitClients = clientsForUser(
    role,
    user?.id ?? null,
    asignables,
  ).map((c) => ({ id: c.id, name: c.name }))

  // Las correcciones de la última ronda, para enseñarlas en la tarjeta que
  // volvió al editor. Solo de lo visible: no hace falta traerlas todas.
  const devueltos = mios.filter((i) => i.approval_status === 'revision_needed').map((i) => i.id)
  const { data: notasRaw } = devueltos.length
    ? await supabase
        .from('content_idea_activity')
        .select('content_idea_id, metadata, created_at, user:profiles(full_name)')
        // Las dos: el revisor del equipo y el cliente por su enlace. El editor
        // corrige lo mismo venga de quien venga; distinguirlo es cosa del autor.
        .in('action', ['changes_requested', 'client_requested_changes'])
        .in('content_idea_id', devueltos)
        .order('created_at', { ascending: false })
    : { data: [] }
  const reviewNotes = latestNoteByIdea((notasRaw ?? []) as unknown as ReviewNoteRow[])

  return (
    <EntregasBoard
      ideas={mios}
      reviewNotes={reviewNotes}
      allClients={activeClients.map((c) => ({ id: c.id, name: c.name }))}
      submitClients={submitClients}
      stages={['edited', 'approval']}
      postingTimes={Object.fromEntries(activeClients.map((c) => [c.id, c.posting_time ?? null]))}
    />
  )
}
