import { VideoPipelineRow } from './video-pipeline-row'
import type { PipelineVideo } from '@/lib/actions/video-pipeline'

const HEAD = 'py-2 pr-3 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground'

export function VideoPipelineTable({
  videos,
  assetCount,
  clientName,
  clientLogoUrl,
  accentColor,
}: {
  videos: PipelineVideo[]
  assetCount: number
  clientName?: string | null
  clientLogoUrl?: string | null
  accentColor?: string | null
}) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full">
        <thead>
          <tr className="border-b bg-muted/30">
            <th className={`${HEAD} pl-3`}>Video</th>
            <th className={HEAD}>Progreso</th>
            <th className={HEAD}>Material</th>
            <th className={`${HEAD} pr-3 text-right`} aria-label="Acción" />
          </tr>
        </thead>
        <tbody className="divide-y">
          {videos.map((video) => (
            <VideoPipelineRow
              key={video.id}
              video={video}
              assetCount={assetCount}
              clientName={clientName}
              clientLogoUrl={clientLogoUrl}
              accentColor={accentColor}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}
