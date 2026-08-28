import Link from 'next/link'
import type { EditorHistoryItem } from '@/lib/pipeline/editor-history'
import { editorHistorySummary, formatHistoryWhen } from '@/lib/pipeline/editor-history'
import { Clapperboard, Film } from 'lucide-react'

const BUCKET_LABEL: Record<EditorHistoryItem['bucket'], string> = {
  revision: 'En corte',
  bank: 'En banco',
  approved: 'Aprobado',
}

export function MemberPipelineHistory({
  editorName,
  items,
}: {
  editorName: string
  items: EditorHistoryItem[]
}) {
  const { revision, bank, approved, avgAgeDays } = editorHistorySummary(items)
  const first = editorName.split(' ')[0] || editorName

  return (
    <section className="space-y-2" data-testid="member-pipeline-history">
      <div className="flex flex-wrap items-center gap-2">
        <Clapperboard className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">Historial de pipeline</h2>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="En corte" value={revision.length} hint={avgAgeDays != null ? `promedio ${avgAgeDays}d` : undefined} />
        <Stat label="Banco" value={bank.length} hint="pendientes" />
        <Stat label="Aprobados" value={approved.length} hint="en el historial" />
      </div>
      {items.length === 0 ? (
        <p className="rounded-lg border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
          {first} no tiene videos en el pipeline todavía.
        </p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border bg-card">
          {items.slice(0, 40).map((item) => (
            <li key={item.ideaId} className="flex items-center gap-3 px-3 py-2">
              <Cover title={item.title} src={item.thumbUrl} />
              <div className="min-w-0 flex-1">
                <Link
                  href={`/produccion/idea/${item.ideaId}`}
                  className="block truncate text-sm font-medium hover:underline"
                >
                  {item.title}
                </Link>
                <p className="truncate text-[11px] text-muted-foreground">{item.clientName}</p>
                <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
                  {formatHistoryWhen(item.at) ?? (item.ageDays != null ? `${item.ageDays}d` : null)}
                </p>
              </div>
              <p className="shrink-0 text-[11px] text-muted-foreground">{BUCKET_LABEL[item.bucket]}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Cover({ title, src }: { title: string; src: string | null }) {
  return src ? (
    <img
      src={src}
      alt={title}
      className="h-12 w-[4.5rem] shrink-0 rounded-md border border-border object-cover bg-muted"
    />
  ) : (
    <span
      aria-hidden
      className="grid h-12 w-[4.5rem] shrink-0 place-items-center rounded-md border border-border bg-muted text-muted-foreground"
    >
      <Film className="h-4 w-4" />
    </span>
  )
}

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-lg border bg-card px-3 py-2 text-center">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  )
}
