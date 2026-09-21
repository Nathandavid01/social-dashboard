import { requirePermission } from '@/lib/auth/server'
import { getIdeacionPipeline } from '@/lib/actions/content-ideas'
import { createClient } from '@/lib/supabase/server'
import { filterEntregasDeliveredIdeas } from '@/lib/utils/entregas-delivery'
import { ReciboBoard } from '@/components/recibo/recibo-board'
import { HumanPoolBridge } from '@/components/recibo/human-pool-bridge'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Recibo — AI intake (auto Listo on approve) + optional human puente to pool.
 * Human videos never enter the pool unless staff clicks Enviar al pool · Listo
 * after Revisión. No Metricool auto-post.
 */
export default async function ReciboPage() {
  await requirePermission('entregas.read')

  const supabase = await createClient()
  const [ideas, clientsRes] = await Promise.all([
    getIdeacionPipeline({ complete: true }),
    supabase
      .from('clients')
      .select('id, name, logo_url, edit_mode')
      .eq('status', 'active')
      .order('name'),
  ])

  type ClientRow = { id: string; name: string; logo_url?: string | null; edit_mode?: string }
  let clients = (clientsRes.data ?? []) as ClientRow[]
  if (clientsRes.error && /edit_mode/i.test(clientsRes.error.message ?? '')) {
    clients = []
  }

  const aiClients = clients.filter((c) => c.edit_mode === 'ai')
  const humanClients = clients.filter((c) => c.edit_mode === 'human' || !c.edit_mode)
  const aiIds = new Set(aiClients.map((c) => c.id))
  const humanIds = new Set(humanClients.map((c) => c.id))

  const entregas = filterEntregasDeliveredIdeas(ideas)
  const aiEntregas = entregas.filter((i) => aiIds.has(i.client_id))
  const aiIdeas = ideas.filter((i) => aiIds.has(i.client_id) && i.status !== 'descartada')
  const byId = new Map(aiIdeas.map((i) => [i.id, i]))
  for (const e of aiEntregas) byId.set(e.id, e)
  const boardIdeas = [...byId.values()]

  const humanIdeas = entregas.filter((i) => humanIds.has(i.client_id) && i.status !== 'descartada')
  const humanIdeaIds = humanIdeas.map((i) => i.id)
  const reviewByIdea: Record<string, string> = {}
  if (humanIdeaIds.length > 0) {
    const reviews = await supabase
      .from('entregas_client_review_items')
      .select('idea_id, status, decided_at')
      .in('idea_id', humanIdeaIds)
      .order('decided_at', { ascending: false })
    for (const row of reviews.data ?? []) {
      const id = row.idea_id as string
      if (reviewByIdea[id]) continue
      reviewByIdea[id] = row.status as string
    }
  }

  return (
    <div className="space-y-10">
      <ReciboBoard ideas={boardIdeas} aiClients={aiClients} />
      <HumanPoolBridge ideas={humanIdeas} humanClients={humanClients} reviewByIdea={reviewByIdea} />
    </div>
  )
}
