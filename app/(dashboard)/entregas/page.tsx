import { requirePermission } from '@/lib/auth/server'
import { getIdeacionPipeline } from '@/lib/actions/content-ideas'
import { createClient } from '@/lib/supabase/server'
import { EntregasBoard } from '@/components/entregas/entregas-board'
import type { EstadoCliente } from '@/lib/entregas/marca-cliente'

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

  const [ideas, { data: activeClientsRaw }] = await Promise.all([
    getIdeacionPipeline({ limit: 400 }),
    supabase
      .from('clients')
      .select('id, name, assigned_to, posting_time')
      .eq('status', 'active')
      .order('name'),
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

  // Lo que el cliente respondió, por video. Solo de lo visible: la tarjeta lo
  // usa para decir "aprobado por el cliente" aunque el copy aún no exista.
  const { data: votos } = entregas.length
    ? await supabase
        .from('entregas_client_review_items')
        .select('idea_id, status')
        .in('idea_id', entregas.map((i) => i.id))
    : { data: [] }
  const clientApprovals = Object.fromEntries(
    (votos ?? []).map((v) => [v.idea_id as string, v.status as EstadoCliente]),
  )

  return (
    <EntregasBoard
      ideas={entregas}
      clientApprovals={clientApprovals}
      allClients={activeClients.map((c) => ({ id: c.id, name: c.name }))}
      postingTimes={Object.fromEntries(activeClients.map((c) => [c.id, c.posting_time ?? null]))}
      stages={['copy', 'publication']}
    />
  )
}
