import Link from 'next/link'
import { Camera, Film } from 'lucide-react'
import { formatHistoryWhen } from '@/lib/pipeline/editor-history'
import { uploadStatusLabel } from '@/lib/onsite/upload-context'
import {
  formatSessionDate,
  videographerHistorySummary,
  type HistoryVideoKind,
  type VideographerHistorySession,
} from '@/lib/recording/videographer-history'

const KIND_LABEL: Record<HistoryVideoKind, string> = {
  raw: 'Crudo',
  broll: 'B-roll',
  edited: 'Editado',
}

export function VideographerHistory({
  sessions,
  own,
  personName,
  truncated = false,
  error,
}: {
  sessions: VideographerHistorySession[]
  own: boolean
  personName?: string | null
  truncated?: boolean
  error?: string | null
}) {
  const summary = videographerHistorySummary(sessions)
  const first = personName?.trim().split(/\s+/)[0] || 'Esta persona'
  const title = own ? 'Tu historial de grabación' : `Historial de grabación de ${personName?.trim() || 'esta persona'}`

  return (
    <section className="space-y-3" data-testid="videographer-history">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 items-center gap-2">
          <Camera className="h-4 w-4 shrink-0 text-primary" />
          <h2 className="min-w-0 truncate text-sm font-semibold">{title}</h2>
        </div>
        <p className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {summary.videos} {summary.videos === 1 ? 'video' : 'videos'} · {summary.additional} {summary.additional === 1 ? 'adicional' : 'adicionales'}
        </p>
      </div>
      <p className="text-xs text-muted-foreground">
        {own
          ? 'Los videos que subiste, agrupados por idea. Las ideas que creaste en la grabación salen como adicionales.'
          : `Los videos que subió ${first}, agrupados por idea. Las ideas que creó en la grabación salen como adicionales.`}
      </p>

      {error ? (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : sessions.length === 0 ? (
        <p className="rounded-lg border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
          Todavía no hay videos ni ideas de grabación.
        </p>
      ) : (
        <div className="space-y-3">
          {truncated && (
            <p className="text-xs text-muted-foreground">Mostrando los 300 videos más recientes.</p>
          )}
          {sessions.map((session) => (
            <article key={session.sessionId ?? `none:${session.clientName}`} className="overflow-hidden rounded-lg border bg-card">
              <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{session.clientName}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {session.sessionId
                      ? [formatSessionDate(session.sessionDate), session.sessionTitle].filter(Boolean).join(' · ')
                      : 'Sin sesión de grabación'}
                  </p>
                </div>
              </header>
              <ul className="divide-y divide-border">
                {session.ideas.map((item) => (
                  <li key={item.ideaId} className="space-y-1.5 px-3 py-2.5">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <Link
                        href={`/produccion/idea/${item.ideaId}`}
                        className="min-w-0 truncate text-sm font-medium hover:underline"
                      >
                        {item.title}
                      </Link>
                      {item.additional && (
                        <span className="shrink-0 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                          Adicional
                        </span>
                      )}
                    </div>
                    {item.videos.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground">Sin video todavía</p>
                    ) : (
                      <ul className="space-y-1">
                        {item.videos.map((video) => (
                          <li key={video.id} className="flex min-w-0 items-center gap-2 text-[12px] text-muted-foreground">
                            <Film className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            <span className="shrink-0 font-medium text-foreground">{KIND_LABEL[video.kind]}</span>
                            <span className="min-w-0 truncate">{video.name}</span>
                            {video.status !== 'uploaded' && (
                              <span className="shrink-0">{uploadStatusLabel(video.status)}</span>
                            )}
                            <span className="ml-auto shrink-0 tabular-nums">{formatHistoryWhen(video.uploadedAt)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
