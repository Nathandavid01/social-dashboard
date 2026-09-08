import type { SyncIdeaRef } from './metricool-sync-core'

/**
 * Reconciliación honesta entre lo que el dashboard cree que mandó a Metricool
 * y lo que de verdad hay allí.
 *
 * El sync viejo solo sabía decir "publicado" o nada, así que una idea cuyo post
 * fue borrado en Metricool se quedaba en 'producida' PARA SIEMPRE — y el
 * tablero la contaba como trabajo en curso. Medido en producción el 28-ago-2026:
 * 67 de 80 envíos no existían en ninguno de los 59 perfiles de la cuenta.
 *
 * Aquí cada envío cae en un desenlace explícito, y "no lo encontré" nunca se
 * confunde con "no salió" cuando la consulta falló.
 */
export type ReconcileOutcome =
  /** Metricool confirma que salió en todas sus redes. */
  | 'published'
  /** Existe y sigue esperando su fecha, o alguna red aún no publica. */
  | 'scheduled'
  /** Exists only as a draft: it will not publish automatically. */
  | 'draft'
  /** Existe pero alguna red falló: necesita mano. */
  | 'failed'
  /** El post ya no existe en Metricool: o lo borraron, o nunca se creó. */
  | 'missing'
  /** No se pudo comprobar (falló la consulta a ese blog). No se decide nada. */
  | 'unknown'

export interface ReconcilePost {
  id: number
  draft?: boolean | null
  providers?: Array<{ status?: string | null }> | null
}

export interface ReconcileRow {
  ideaId: string
  postId: number
  outcome: ReconcileOutcome
}

export interface ReconcileResult {
  rows: ReconcileRow[]
  /** Ideas a marcar 'publicada': solo las confirmadas. */
  toMarkPublished: string[]
  /** Envíos que se evaporaron — hay que republicarlos o cerrarlos a mano. */
  missing: ReconcileRow[]
  counts: Record<ReconcileOutcome, number>
}

function outcomeOf(post: ReconcilePost): ReconcileOutcome {
  if (post.draft) return 'draft'
  const providers = post.providers ?? []
  if (providers.length === 0) return 'scheduled'
  if (providers.some((p) => p.status === 'ERROR')) return 'failed'
  return providers.every((p) => p.status === 'PUBLISHED') ? 'published' : 'scheduled'
}

/**
 * @param lookupComplete false cuando alguna consulta a Metricool falló. Con la
 * foto incompleta, lo no encontrado es 'unknown' y NO se toca: declarar
 * "desapareció" por un fallo de red sería peor que no saber.
 */
export function reconcilePostedIdeas(
  ideas: SyncIdeaRef[],
  posts: Iterable<ReconcilePost>,
  lookupComplete = true,
): ReconcileResult {
  const byId = new Map<number, ReconcilePost>()
  for (const p of posts) byId.set(p.id, p)

  const rows: ReconcileRow[] = []
  for (const idea of ideas) {
    const postId = idea.metricool_post_id
    if (postId == null) continue
    if (idea.status === 'publicada' || idea.status === 'descartada') continue
    const post = byId.get(postId)
    const outcome: ReconcileOutcome = post
      ? outcomeOf(post)
      : lookupComplete
        ? 'missing'
        : 'unknown'
    rows.push({ ideaId: idea.id, postId, outcome })
  }

  const counts: Record<ReconcileOutcome, number> = {
    published: 0,
    scheduled: 0,
    draft: 0,
    failed: 0,
    missing: 0,
    unknown: 0,
  }
  for (const r of rows) counts[r.outcome] += 1

  return {
    rows,
    toMarkPublished: rows.filter((r) => r.outcome === 'published').map((r) => r.ideaId),
    missing: rows.filter((r) => r.outcome === 'missing'),
    counts,
  }
}
