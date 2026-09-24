import { requirePermission } from '@/lib/auth/server'
import { getIdeacionPipeline } from '@/lib/actions/content-ideas'
import { createClient } from '@/lib/supabase/server'
import { reciboBoardIdeas } from '@/lib/recibo/board-ideas'
import { ReciboBoard } from '@/components/recibo/recibo-board'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Recibo — videos waiting for approval, or approved and still waiting
 * to be posted or scheduled in Metricool. No Metricool auto-post.
 */
export default async function ReciboPage() {
  await requirePermission('entregas.read')

  const supabase = await createClient()
  const [ideas, aiClientsRes] = await Promise.all([
    getIdeacionPipeline({ complete: true }),
    supabase
      .from('clients')
      .select('id, name, logo_url, edit_mode')
      .eq('status', 'active')
      .eq('edit_mode', 'ai')
      .order('name'),
  ])

  let aiClients = (aiClientsRes.data ?? []) as { id: string; name: string; logo_url?: string | null; edit_mode?: string }[]
  if (aiClientsRes.error && /edit_mode/i.test(aiClientsRes.error.message ?? '')) {
    aiClients = []
  }

  const boardIdeas = reciboBoardIdeas(ideas)
  const shownClientIds = new Set(boardIdeas.map((idea) => idea.client_id))
  const boardClients = aiClients.filter((client) => shownClientIds.has(client.id))

  // Padding comes from dashboard layout — keep this wrapper lean for mobile width.
  return <ReciboBoard ideas={boardIdeas} aiClients={boardClients} />
}
