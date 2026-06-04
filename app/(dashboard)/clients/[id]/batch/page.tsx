import { notFound } from 'next/navigation'
import { getClientVideoBatch } from '@/lib/actions/video-pipeline'
import { requirePermission } from '@/lib/auth/server'
import { ClientBatchView } from '@/components/clients/batch/client-batch-view'

/**
 * Full-screen Client Batch view: opening a client shows the whole batch of
 * videos being worked, with a stage stepper, a "what to do next" hint, the video
 * grid and a master-detail panel. Designed for beginners and high-traffic use.
 */
export default async function ClientBatchPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requirePermission('clients.read')
  const { id } = await params
  const pipeline = await getClientVideoBatch(id)
  if (!pipeline) notFound()

  return <ClientBatchView pipeline={pipeline} />
}
