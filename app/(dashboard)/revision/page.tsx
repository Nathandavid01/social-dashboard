import { requirePermission, getCurrentRole } from '@/lib/auth/server'
import { getIdeacionPipeline } from '@/lib/actions/content-ideas'
import { createClient } from '@/lib/supabase/server'
import { clientsForUser } from '@/lib/utils/client-visibility'
import { EntregasBoard } from '@/components/entregas/entregas-board'

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
    supabase.from('clients').select('id, name, assigned_to, posting_time').eq('status', 'active').order('name'),
    getCurrentRole(),
    supabase.auth.getUser(),
  ])

  const activeClients = activeClientsRaw ?? []

  // Solo lo entregado por este flujo: un video con su archivo ya en R2. Sin
  // esto heredaría las ideas históricas, que nunca pasaron por aquí.
  const entregados = ideas.filter((i) =>
    (i.videos ?? []).some((v) => v.kind === 'edited' && v.storage_provider === 'entregas-r2'),
  )

  // El desplegable solo ofrece lo que esta persona trabaja. Filtro de
  // conveniencia — ver la nota en client-visibility.ts; no es control de acceso.
  const submitClients = clientsForUser(
    role,
    user?.id ?? null,
    activeClients.map((c) => ({ id: c.id, name: c.name, assigned_to: c.assigned_to ?? null })),
  ).map((c) => ({ id: c.id, name: c.name }))

  return (
    <EntregasBoard
      ideas={entregados}
      allClients={activeClients.map((c) => ({ id: c.id, name: c.name }))}
      submitClients={submitClients}
      stages={['edited', 'approval']}
      postingTimes={Object.fromEntries(activeClients.map((c) => [c.id, c.posting_time ?? null]))}
    />
  )
}
