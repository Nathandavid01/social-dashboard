import Link from 'next/link'
import { CheckCircle2, Clock3, FileVideo2, History, TriangleAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { VideoUploadLogItem } from '@/lib/actions/video-upload-log'

const KIND_LABEL: Record<VideoUploadLogItem['kind'], string> = {
  raw: 'Crudo',
  broll: 'B-roll',
  edited: 'Editado',
}

const STATUS_CONFIG: Record<VideoUploadLogItem['status'], { label: string; className: string }> = {
  uploading: { label: 'Subiendo', className: 'border-blue-500/20 bg-blue-500/10 text-blue-600' },
  uploaded: { label: 'Subido', className: 'border-green-500/20 bg-green-500/10 text-green-600' },
  processing: { label: 'Procesando', className: 'border-amber-500/20 bg-amber-500/10 text-amber-600' },
  failed: { label: 'Falló', className: 'border-red-500/20 bg-red-500/10 text-red-600' },
  archived: { label: 'Archivado', className: 'border-muted bg-muted/50 text-muted-foreground' },
}

function formatSize(bytes: number | null): string {
  if (bytes == null) return 'Tamaño desconocido'
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function formatUploadedAt(value: string): string {
  return new Intl.DateTimeFormat('es-PR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Puerto_Rico',
  }).format(new Date(value))
}

export function VideoUploadLog({ items }: { items: VideoUploadLogItem[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center">
        <History className="mx-auto mb-2 h-6 w-6 text-muted-foreground/50" />
        <p className="text-sm font-medium text-muted-foreground">Todavía no has subido videos</p>
        <p className="text-xs text-muted-foreground/70">Cada archivo que subas aparecerá aquí con su fecha y estado.</p>
      </div>
    )
  }

  const completed = items.filter((item) => item.status === 'uploaded').length
  const attention = items.filter((item) => item.status === 'failed').length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1">
          <History className="h-3.5 w-3.5" /> {items.length} subida{items.length === 1 ? '' : 's'} reciente{items.length === 1 ? '' : 's'}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1">
          <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> {completed} completada{completed === 1 ? '' : 's'}
        </span>
        {attention > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-red-600">
            <TriangleAlert className="h-3.5 w-3.5" /> {attention} requiere{attention === 1 ? '' : 'n'} atención
          </span>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="divide-y">
          {items.map((item) => {
            const status = STATUS_CONFIG[item.status]
            return (
              <div key={item.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-purple-500/10 text-purple-600">
                  <FileVideo2 className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <Link href={`/produccion/idea/${item.ideaId}`} className="block truncate text-sm font-semibold hover:text-primary">
                    {item.name}
                  </Link>
                  <p className="truncate text-xs text-muted-foreground">
                    {item.clientName} · {item.ideaTitle}
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Clock3 className="h-3 w-3" />
                    <time dateTime={item.uploadedAt}>{formatUploadedAt(item.uploadedAt)}</time>
                    <span aria-hidden="true">·</span>
                    <span>{formatSize(item.sizeBytes)}</span>
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant="outline">{KIND_LABEL[item.kind]}</Badge>
                  <Badge variant="outline" className={cn(status.className)}>{status.label}</Badge>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
