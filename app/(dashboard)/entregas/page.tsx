import { requirePermission, currentUserHas } from '@/lib/auth/server'
import { getIdeacionPipeline } from '@/lib/actions/content-ideas'
import { createClient } from '@/lib/supabase/server'
import { EntregasBoard } from '@/components/entregas/entregas-board'
import { SupervisorProcessSteps } from '@/components/onsite/supervisor-process-steps'
import { buildPostedLinks } from '@/lib/entregas/posted-links'
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

  const [ideas, { data: activeClientsRaw }, showProcess] = await Promise.all([
    getIdeacionPipeline({ limit: 400 }),
    supabase
      .from('clients')
      .select('id, name, assigned_to, posting_time')
      .eq('status', 'active')
      .order('name'),
    currentUserHas('recording.brief'),
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

  // Dos lecturas independientes sobre lo visible, en paralelo:
  // - votos: lo que el cliente respondió, para decir "aprobado por el cliente".
  // - envios: la URL exacta que Metricool recibió (log posted_to_metricool),
  //   para el enlace "Ver post enviado". Viene del log, no del archivo actual:
  //   el enlace audita lo que SE ENVIÓ.
  const ids = entregas.map((i) => i.id)
  const enviadasIds = entregas.filter((i) => i.metricool_post_id != null).map((i) => i.id)
  const [{ data: votos }, { data: envios }] = await Promise.all([
    ids.length
      ? supabase.from('entregas_client_review_items').select('idea_id, status').in('idea_id', ids)
      : { data: [] },
    enviadasIds.length
      ? supabase
          .from('content_idea_activity')
          .select('content_idea_id, created_at, metadata')
          .eq('action', 'posted_to_metricool')
          .in('content_idea_id', enviadasIds)
      : { data: [] },
  ])
  const clientApprovals = Object.fromEntries(
    (votos ?? []).map((v) => [v.idea_id as string, v.status as EstadoCliente]),
  )
  const postedLinks = buildPostedLinks(envios ?? [])

  return (
    <div className="space-y-4">
      {showProcess && <SupervisorProcessSteps pathname="/entregas" />}
      <EntregasBoard
        ideas={entregas}
        clientApprovals={clientApprovals}
        postedLinks={postedLinks}
        allClients={activeClients.map((c) => ({ id: c.id, name: c.name }))}
        postingTimes={Object.fromEntries(activeClients.map((c) => [c.id, c.posting_time ?? null]))}
        stages={['copy', 'publication']}
        // La cadencia del cliente y lo que recibe Metricool es el día de
        // PUBLICACIÓN. La Guira publica lunes, miércoles y viernes; verla en
        // domingo, martes y jueves no se entendía.
        modoDia="publicacion"
      />
    </div>
  )
}
