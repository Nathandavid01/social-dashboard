import { requirePermission } from '@/lib/auth/server'
import { getApprovedIdeas } from '@/lib/actions/idea-feedback'
import { PageHeader } from '@/components/shared/page-header'
import { ApprovedIdeasList } from '@/components/ideas/approved-ideas-list'
import type { ApprovedIdea } from '@/lib/actions/idea-feedback-types'

export const dynamic = 'force-dynamic'

export default async function IdeasAprobadasPage() {
  await requirePermission('ideas.read')

  let ideas: ApprovedIdea[] = []
  try {
    ideas = await getApprovedIdeas()
  } catch {
    // Table not yet migrated (0032) — show the empty state instead of erroring.
    ideas = []
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Ideas Aprobadas"
        description="Ideas que el equipo de marketing aprobó en el Lab. Editores y diseñadores pueden tomarlas de aquí."
      />
      <ApprovedIdeasList ideas={ideas} />
    </div>
  )
}
