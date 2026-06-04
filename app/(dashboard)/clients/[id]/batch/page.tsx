import { notFound } from 'next/navigation'
import { getClientBatchData } from '@/lib/actions/client-batch'
import { requirePermission } from '@/lib/auth/server'
import { ClientBatchView } from '@/components/clients/batch/client-batch-view'

/**
 * Full-screen Client Batch view (deep-link route). The pipeline board opens the
 * same view as an in-place overlay; this route keeps it shareable/bookmarkable.
 */
export default async function ClientBatchPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requirePermission('clients.read')
  const { id } = await params
  const data = await getClientBatchData(id)
  if (!data) notFound()

  return (
    <ClientBatchView
      pipeline={data.pipeline}
      plannedSlots={data.plannedSlots}
      config={data.config}
      members={data.members}
    />
  )
}
