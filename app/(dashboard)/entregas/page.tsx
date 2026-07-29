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
  await requirePermission('entregas.read')
  const supabase = await createClient()

  const [ideas, { data: activeClientsRaw }, role, { data: { user } }] = await Promise.all([
    getIdeacionPipeline({ limit: 400 }),
    supabase
      .from('clients')
      .select('id, name, assigned_to, posting_time')
      .eq('status', 'active')
      .order('name'),
    getCurrentRole(),
    supabase.auth.getUser(),
  ])

  const activeClients = activeClientsRaw ?? []

  /**
   * Entregas only shows what came through THIS flow: a video with its edited
   * file already in R2. The board reads the same content_ideas table as
   * /pipeline, so without this filter it would inherit all 225 historical
   * ideas — work that never passed through here and that nobody in this flow
   * is waiting on.
   *
   * A row whose upload failed has no file, so it stays out until it's really
   * delivered. Nothing is deleted; /pipeline still shows everything.
   */
  const entregas = ideas.filter((i) =>
    (i.videos ?? []).some((v) => v.kind === 'edited' && v.storage_provider === 'entregas-r2'),
  )

  // The submit dropdown only offers what this person may work on. Convenience
  // filter — see the note in client-visibility.ts; it is not access control.
  const submitClients = clientsForUser(
    role,
    user?.id ?? null,
    activeClients.map((c) => ({ id: c.id, name: c.name, assigned_to: c.assigned_to ?? null })),
  ).map((c) => ({ id: c.id, name: c.name }))

  return (
    <EntregasBoard
      ideas={entregas}
      allClients={activeClients.map((c) => ({ id: c.id, name: c.name }))}
      postingTimes={Object.fromEntries(activeClients.map((c) => [c.id, c.posting_time ?? null]))}
      editedColumnSlot={(dia) => <EditorSubmitSlot clients={submitClients} dia={dia} />}
    />
  )
}
