import { PageHeader } from '@/components/shared/page-header'
import { PostingBoard } from '@/components/posting/posting-board'
import { getPostingQueue } from '@/lib/actions/posting'

export const dynamic = 'force-dynamic'

export default async function PostingPage() {
  const queue = await getPostingQueue()

  const pending = queue.filter((q) => !q.draft || q.draft.status === 'failed')
  const sent = queue.filter((q) => q.draft?.status === 'sent')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Posting"
        description={`${pending.length} video${pending.length !== 1 ? 's' : ''} listo${pending.length !== 1 ? 's' : ''} para publicar`}
      />
      <PostingBoard initialPending={pending} initialSent={sent} />
    </div>
  )
}
