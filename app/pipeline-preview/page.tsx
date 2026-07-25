import { PipelinePreview } from './pipeline-preview'

export const dynamic = 'force-dynamic'

/**
 * DEV PREVIEW of the 5-column pipeline + internal review panel, rendered from
 * hard-coded sample data. It exists because the real /pipeline needs Supabase
 * credentials and a logged-in session; this route needs neither, so the flow
 * can be reviewed in the browser before the env is wired up.
 *
 * Not linked from the sidebar. Delete it (and this folder) once /pipeline is
 * reachable with real data.
 */
export default function PipelinePreviewPage() {
  return <PipelinePreview />
}
