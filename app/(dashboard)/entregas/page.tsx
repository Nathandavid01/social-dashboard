import { requirePermission, getCurrentRole } from '@/lib/auth/server'
import { getIdeacionPipeline } from '@/lib/actions/content-ideas'
import { createClient } from '@/lib/supabase/server'
import { clientsForUser } from '@/lib/utils/client-visibility'
import { EntregasBoard } from '@/components/entregas/entregas-board'
import { EditorSubmitSlot } from '@/components/pipeline/editor-submit-slot'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Entregas — the editor-first flow: Editado → Revisión → Copy → Publicación.
 *
 * Deliberately separate from /pipeline (Eric's board), which keeps its own
 * stages and its own derivation. Both read the same content_ideas rows; they
 * only disagree on how to bucket them, so a video is never "in" one and not the
 * other — it's the same row seen through two lenses.
 */
export default async function EntregasPage() {
  await requirePermission('planning.read')
  const supabase = await createClient()

  const [ideas, { data: activeClientsRaw }, role, { data: { user } }] = await Promise.all([
    getIdeacionPipeline({ limit: 400 }),
    supabase
      .from('clients')
      .select('id, name, assigned_to')
      .eq('status', 'active')
      .order('name'),
    getCurrentRole(),
    supabase.auth.getUser(),
  ])

  const activeClients = activeClientsRaw ?? []

  // The submit dropdown only offers what this person may work on. Convenience
  // filter — see the note in client-visibility.ts; it is not access control.
  const submitClients = clientsForUser(
    role,
    user?.id ?? null,
    activeClients.map((c) => ({ id: c.id, name: c.name, assigned_to: c.assigned_to ?? null })),
  ).map((c) => ({ id: c.id, name: c.name }))

  return (
    <EntregasBoard
      ideas={ideas}
      allClients={activeClients.map((c) => ({ id: c.id, name: c.name }))}
      editedColumnSlot={<EditorSubmitSlot clients={submitClients} />}
    />
  )
}
