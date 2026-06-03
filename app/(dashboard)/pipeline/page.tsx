import { requirePermission } from '@/lib/auth/server'
import { getIdeacionPipeline } from '@/lib/actions/content-ideas'
import { ContentPipelineBoard } from '@/components/pipeline/content-pipeline-board'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Global Content Pipeline board — every client's videos on one Trello-style
 * board, filterable by client. Reference design: "Content Pipeline Board".
 */
export default async function PipelinePage() {
  await requirePermission('planning.read')
  const ideas = await getIdeacionPipeline({ limit: 400 })
  return <ContentPipelineBoard ideas={ideas} />
}
