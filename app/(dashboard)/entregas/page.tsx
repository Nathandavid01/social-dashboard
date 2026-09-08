import { readCompletePages } from '@/lib/utils/read-complete-pages'
import { filterEntregasDeliveredIdeas } from '@/lib/utils/entregas-delivery'
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
  try {
    const supabase = await createClient()

    const [ideas, activeClients, showProcess] = await Promise.all([
      getIdeacionPipeline({ complete: true }),
      readCompletePages((from, to) => supabase
        .from('clients')
        .select('id, name, assigned_to, posting_time', { count: 'exact' })
        .eq('status', 'active')
        .order('name').order('id').range(from, to)),
      currentUserHas('recording.brief'),
    ])



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
    const entregas = filterEntregasDeliveredIdeas(ideas)

    // Dos lecturas independientes sobre lo visible, en paralelo:
    // - votos: lo que el cliente respondió, para decir "aprobado por el cliente".
    // - envios: la URL exacta que Metricool recibió (log posted_to_metricool),
    //   para el enlace "Ver post enviado". Viene del log, no del archivo actual:
    //   el enlace audita lo que SE ENVIÓ.
    const ids = entregas.map((i) => i.id)
    const enviadasIds = entregas.filter((i) => i.metricool_post_id != null).map((i) => i.id)
    const [votos, envios] = await Promise.all([
      ids.length
        ? readCompletePages((from, to) => supabase.from('entregas_client_review_items').select('id, idea_id, status', { count: 'exact' }).in('idea_id', ids).order('id').range(from, to))
        : [],
      enviadasIds.length
        ? readCompletePages((from, to) => supabase
            .from('content_idea_activity')
            .select('id, content_idea_id, created_at, metadata', { count: 'exact' })
            .eq('action', 'posted_to_metricool')
            .in('content_idea_id', enviadasIds).order('id').range(from, to))
        : [],
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
  } catch {
    return <section role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
      <h1 className="font-semibold">No Se Pudo Cargar Entregas</h1>
      <p className="mt-2 text-sm">No pudimos verificar los videos, clientes, aprobaciones o envíos. Vuelve a cargar antes de agendar.</p>
      <a href="/entregas" className="mt-4 inline-flex min-h-11 items-center rounded-lg border px-4 text-sm font-medium">Volver A Cargar Entregas</a>
    </section>
  }
}
