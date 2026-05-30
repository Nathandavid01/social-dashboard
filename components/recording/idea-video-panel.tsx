'use client'

import { useRef, useState, useTransition } from 'react'
import { Video, Upload, Download, Trash2, Loader2, Camera, Clapperboard, ExternalLink, Plus, Play, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useToast } from '@/lib/hooks/use-toast'
import { useHasPermission } from '@/components/auth/role-gate'
import { getR2UploadUrl, registerR2Video, getR2DownloadUrl, getR2PreviewUrl, deleteR2Video } from '@/lib/actions/idea-videos-r2'
import type { ContentIdeaVideo, ContentIdeaVideoKind } from '@/lib/supabase/types'

interface Props {
  ideaId: string
  ideaTitle?: string
  videos: ContentIdeaVideo[]
  compact?: boolean
  /** True when R2 public access is configured (edited videos served publicly). */
  publicEnabled?: boolean
}

const META: Record<ContentIdeaVideoKind, { label: string; sub: string; icon: typeof Camera; tone: string }> = {
  raw:    { label: 'Video crudo',   sub: 'Material grabado, listo para editar', icon: Camera,       tone: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/30' },
  broll:  { label: 'B-roll',        sub: 'Tomas de apoyo',                      icon: Video,        tone: 'text-teal-500 bg-teal-500/10 border-teal-500/30' },
  edited: { label: 'Video editado', sub: 'Versión final para QC',               icon: Clapperboard, tone: 'text-purple-500 bg-purple-500/10 border-purple-500/30' },
}

function formatBytes(n: number | null): string {
  if (!n) return ''
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`
}

/** Upload time, e.g. "2 jun, 3:42 p. m." — so it's clear WHEN the video landed. */
function formatUploadedAt(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('es-PR', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true })
}

const MIN_SLOTS: Record<ContentIdeaVideoKind, number> = { raw: 4, broll: 4, edited: 2 }

export function IdeaVideoPanel({ ideaId, videos, publicEnabled = false }: Props) {
  const canUpload = useHasPermission('video.upload')
  const uploaded = videos.filter((v) => v.status === 'uploaded')
  const rawVideos = uploaded.filter((v) => v.kind === 'raw')
  const brollVideos = uploaded.filter((v) => v.kind === 'broll')
  const editedVideos = uploaded.filter((v) => v.kind === 'edited')
  const hasRaw = rawVideos.length > 0

  return (
    <div className="space-y-5">
      <SlotGroup kind="raw" ideaId={ideaId} videos={rawVideos} canUpload={canUpload} publicEnabled={publicEnabled} />
      <SlotGroup kind="broll" ideaId={ideaId} videos={brollVideos} canUpload={canUpload} publicEnabled={publicEnabled} />
      <SlotGroup
        kind="edited"
        ideaId={ideaId}
        videos={editedVideos}
        canUpload={canUpload}
        publicEnabled={publicEnabled}
        disabledReason={!hasRaw ? 'Sube el video crudo primero' : undefined}
      />
    </div>
  )
}

/**
 * Per-video status pill so it's clear what's in R2 at a glance: uploaded /
 * processing / failed / archived, plus a "Público" tag for final (edited)
 * videos when public access is configured.
 */
const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  uploaded:   { label: 'Subido',     cls: 'bg-green-500/15 text-green-600 border-green-500/30' },
  uploading:  { label: 'Subiendo',   cls: 'bg-blue-500/15 text-blue-600 border-blue-500/30' },
  processing: { label: 'Procesando', cls: 'bg-amber-500/15 text-amber-600 border-amber-500/30' },
  failed:     { label: 'Falló',      cls: 'bg-red-500/15 text-red-600 border-red-500/30' },
  archived:   { label: 'Archivado',  cls: 'bg-muted text-muted-foreground border-border' },
}

function VideoStatusBadges({
  video, kind, publicEnabled,
}: {
  video: ContentIdeaVideo
  kind: ContentIdeaVideoKind
  publicEnabled: boolean
}) {
  const badge = STATUS_BADGE[video.status] ?? STATUS_BADGE.uploaded
  const isR2 = video.storage_provider === 'r2'
  const isPublic = isR2 && kind === 'edited' && publicEnabled && video.status === 'uploaded'
  const pill = 'rounded border px-1.5 py-0.5 text-[10px] font-medium'
  return (
    <span className="mt-1 flex flex-wrap items-center gap-1">
      <span className={cn(pill, badge.cls)}>{badge.label}</span>
      <span className={cn(pill, 'bg-muted text-muted-foreground border-border')}>{isR2 ? 'R2' : 'Drive'}</span>
      {isPublic && (
        <span className={cn(pill, 'bg-purple-500/15 text-purple-600 border-purple-500/30')}>Público</span>
      )}
    </span>
  )
}

function SlotGroup({
  kind, ideaId, videos, canUpload, publicEnabled, disabledReason,
}: {
  kind: ContentIdeaVideoKind
  ideaId: string
  videos: ContentIdeaVideo[]
  canUpload: boolean
  publicEnabled: boolean
  disabledReason?: string
}) {
  const meta = META[kind]
  const Icon = meta.icon
  const min = MIN_SLOTS[kind]
  // Extra empty slots the user explicitly added beyond the minimum.
  const [extra, setExtra] = useState(0)

  // Minimum visible empty slots so the group always shows at least `min` rows.
  const minEmpties = Math.max(0, min - videos.length)
  const emptyCount = minEmpties + extra

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-x-3">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <Icon className="h-3.5 w-3.5" /> {meta.label}
          <span className="tabular-nums font-normal normal-case text-muted-foreground/70">
            {videos.length}/{min}
          </span>
        </p>
      </div>

      <div className="space-y-2.5">
        {videos.map((v) => (
          <Slot key={v.id} kind={kind} ideaId={ideaId} video={v} canUpload={canUpload} publicEnabled={publicEnabled} />
        ))}
        {Array.from({ length: emptyCount }).map((_, i) => (
          <Slot
            key={`empty-${i}`}
            kind={kind}
            ideaId={ideaId}
            video={undefined}
            canUpload={canUpload}
            publicEnabled={publicEnabled}
            disabledReason={disabledReason}
          />
        ))}
      </div>

      {canUpload && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setExtra((n) => n + 1)}
          className="h-8 text-xs text-muted-foreground hover:text-primary"
        >
          <Plus className="mr-1 h-3.5 w-3.5" /> Agregar más {meta.label.toLowerCase()}
        </Button>
      )}
    </div>
  )
}

function Slot({
  kind, ideaId, video, canUpload, publicEnabled, disabledReason,
}: {
  kind: ContentIdeaVideoKind
  ideaId: string
  video: ContentIdeaVideo | undefined
  canUpload: boolean
  publicEnabled: boolean
  disabledReason?: string
}) {
  const meta = META[kind]
  const Icon = meta.icon
  const fileRef = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [isPending, startTransition] = useTransition()
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [batch, setBatch] = useState<{ done: number; total: number } | null>(null)
  const { toast } = useToast()

  async function togglePreview() {
    if (!video) return
    if (previewUrl) {
      setPreviewUrl(null)
      return
    }
    setPreviewLoading(true)
    const res = await getR2PreviewUrl(video.id)
    setPreviewLoading(false)
    if (res.error || !res.url) {
      toast({ title: 'Error', description: res.error ?? 'No se pudo cargar el preview', variant: 'destructive' })
      return
    }
    setPreviewUrl(res.url)
  }

  const MAX_BYTES = 5 * 1024 * 1024 * 1024

  // Upload a single file end-to-end (presign → PUT → register). Throws on failure.
  async function uploadOne(file: File) {
    const slot = await getR2UploadUrl({ ideaId, kind, fileName: file.name, contentType: file.type || 'video/mp4' })
    if (slot.error || !slot.url || !slot.key) throw new Error(slot.error ?? 'No se pudo iniciar la subida')

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('PUT', slot.url!, true)
      xhr.setRequestHeader('Content-Type', file.type || 'video/mp4')
      xhr.upload.onprogress = (e) => { if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100)) }
      xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`R2 ${xhr.status}`)))
      xhr.onerror = () => reject(new Error('Error de red durante la subida'))
      xhr.send(file)
    })

    const res = await registerR2Video({
      ideaId, kind, key: slot.key!, name: file.name, sizeBytes: file.size, mimeType: file.type || 'video/mp4',
    })
    if (res.error) throw new Error(res.error)
  }

  // Accepts one OR many files; uploads them sequentially into this kind.
  async function handleFiles(files: FileList | File[] | null) {
    const list = Array.from(files ?? [])
    if (list.length === 0) return
    const ok = list.filter((f) => f.size <= MAX_BYTES)
    if (ok.length < list.length) {
      toast({ title: 'Algunos archivos son muy grandes', description: 'Máximo 5 GB por archivo', variant: 'destructive' })
    }
    if (ok.length === 0) return

    let failed = 0
    for (let i = 0; i < ok.length; i++) {
      setBatch({ done: i, total: ok.length })
      setProgress(0)
      try {
        await uploadOne(ok[i])
      } catch (err) {
        failed++
        toast({ title: 'Falló una subida', description: err instanceof Error ? err.message : 'Error', variant: 'destructive' })
      }
    }
    setBatch(null)
    setProgress(null)

    const done = ok.length - failed
    if (done > 0) {
      const label = meta.label.toLowerCase()
      toast({ title: done === 1 ? `${label} subido` : `${done} ${label}s subidos` })
    }
  }

  async function download() {
    if (!video) return
    const res = await getR2DownloadUrl(video.id)
    if (res.error) toast({ title: 'Error', description: res.error, variant: 'destructive' })
    else if (res.url) window.open(res.url, '_blank')
  }

  if (video) {
    const isR2 = video.storage_provider === 'r2'
    return (
      <div className="space-y-2">
      <div className={cn('flex items-center gap-3 rounded-lg border p-3', meta.tone)}>
        <div className={cn('grid h-11 w-14 shrink-0 place-items-center rounded', meta.tone)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide">
            <Icon className="h-3 w-3" /> {meta.label}
          </p>
          <p className="truncate text-sm font-medium">{video.name}</p>
          <p className="text-xs text-muted-foreground">
            {formatBytes(video.size_bytes)}
            {video.uploaded_at ? ` · subido ${formatUploadedAt(video.uploaded_at)}` : ''}
          </p>
          <VideoStatusBadges video={video} kind={kind} publicEnabled={publicEnabled} />
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {isR2 && (
            <Button size="sm" variant="outline" onClick={togglePreview} disabled={previewLoading}>
              {previewLoading ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : previewUrl ? (
                <X className="mr-1 h-3.5 w-3.5" />
              ) : (
                <Play className="mr-1 h-3.5 w-3.5" />
              )}
              Ver
            </Button>
          )}
          {isR2 ? (
            <Button size="sm" variant="outline" onClick={download}>
              <Download className="mr-1 h-3.5 w-3.5" /> Bajar
            </Button>
          ) : video.drive_view_link ? (
            <a href={video.drive_view_link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-xs hover:bg-accent">
              <ExternalLink className="h-3 w-3" /> Drive
            </a>
          ) : null}
          {canUpload && (
            <button
              onClick={() => {
                if (!confirm(`¿Quitar este ${meta.label.toLowerCase()}?`)) return
                startTransition(async () => {
                  const res = await deleteR2Video(video.id, ideaId)
                  if (res.error) toast({ title: 'Error', description: res.error, variant: 'destructive' })
                  else toast({ title: 'Video eliminado' })
                })
              }}
              className="rounded-md p-1.5 text-muted-foreground hover:text-destructive"
              disabled={isPending}
              aria-label="Eliminar"
            >
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
      </div>
        {previewUrl && (
          <video
            src={previewUrl}
            controls
            playsInline
            className="aspect-video w-full rounded-lg border bg-black"
          />
        )}
      </div>
    )
  }

  if (!canUpload) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-dashed p-2.5 text-xs text-muted-foreground opacity-70">
        <Icon className="h-3.5 w-3.5" /> {meta.label} pendiente
      </div>
    )
  }

  if (progress !== null) {
    return (
      <div className={cn('rounded-lg border p-3', meta.tone)}>
        <div className="mb-2 flex items-center justify-between text-xs font-medium">
          <span className="flex items-center gap-1.5">
            <Icon className="h-3.5 w-3.5" /> Subiendo {meta.label.toLowerCase()}…
            {batch && batch.total > 1 && (
              <span className="text-muted-foreground">({batch.done + 1} de {batch.total})</span>
            )}
          </span>
          <span className="tabular-nums">{progress}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-background/60">
          <div className="h-full bg-current transition-all duration-200" style={{ width: `${progress}%` }} />
        </div>
      </div>
    )
  }

  return (
    <button
      type="button"
      disabled={!!disabledReason}
      onClick={() => fileRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-primary', 'bg-primary/5') }}
      onDragLeave={(e) => e.currentTarget.classList.remove('border-primary', 'bg-primary/5')}
      onDrop={(e) => {
        e.preventDefault()
        e.currentTarget.classList.remove('border-primary', 'bg-primary/5')
        handleFiles(e.dataTransfer.files)
      }}
      className={cn(
        'group flex w-full items-center gap-2 rounded-lg border border-dashed p-3 text-left text-sm transition-all',
        'hover:border-primary hover:bg-primary/5',
        disabledReason && 'cursor-not-allowed opacity-50 hover:border-dashed hover:bg-transparent',
      )}
    >
      <div className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-md', meta.tone)}><Icon className="h-4 w-4" /></div>
      <div className="min-w-0 flex-1">
        <p className="font-medium">Subir {meta.label.toLowerCase()}</p>
        <p className="text-[10px] text-muted-foreground">{disabledReason ?? meta.sub} · arrastra uno o varios o haz click</p>
      </div>
      <Upload className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:scale-110 group-hover:text-primary" />
      <input ref={fileRef} type="file" accept="video/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
    </button>
  )
}
