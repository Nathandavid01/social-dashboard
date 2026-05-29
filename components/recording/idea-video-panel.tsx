'use client'

import { useRef, useState, useTransition } from 'react'
import { Video, Upload, Download, Trash2, Loader2, Camera, Clapperboard, ExternalLink, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useToast } from '@/lib/hooks/use-toast'
import { useHasPermission } from '@/components/auth/role-gate'
import { getR2UploadUrl, registerR2Video, getR2DownloadUrl, deleteR2Video } from '@/lib/actions/idea-videos-r2'
import type { ContentIdeaVideo, ContentIdeaVideoKind } from '@/lib/supabase/types'

interface Props {
  ideaId: string
  ideaTitle?: string
  videos: ContentIdeaVideo[]
  compact?: boolean
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

const MIN_SLOTS: Record<ContentIdeaVideoKind, number> = { raw: 4, broll: 4, edited: 2 }

export function IdeaVideoPanel({ ideaId, videos }: Props) {
  const canUpload = useHasPermission('video.upload')
  const uploaded = videos.filter((v) => v.status === 'uploaded')
  const rawVideos = uploaded.filter((v) => v.kind === 'raw')
  const brollVideos = uploaded.filter((v) => v.kind === 'broll')
  const editedVideos = uploaded.filter((v) => v.kind === 'edited')
  const hasRaw = rawVideos.length > 0

  return (
    <div className="space-y-5">
      <SlotGroup kind="raw" ideaId={ideaId} videos={rawVideos} canUpload={canUpload} />
      <SlotGroup kind="broll" ideaId={ideaId} videos={brollVideos} canUpload={canUpload} />
      <SlotGroup
        kind="edited"
        ideaId={ideaId}
        videos={editedVideos}
        canUpload={canUpload}
        disabledReason={!hasRaw ? 'Sube el video crudo primero' : undefined}
      />
    </div>
  )
}

function SlotGroup({
  kind, ideaId, videos, canUpload, disabledReason,
}: {
  kind: ContentIdeaVideoKind
  ideaId: string
  videos: ContentIdeaVideo[]
  canUpload: boolean
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
          <Slot key={v.id} kind={kind} ideaId={ideaId} video={v} canUpload={canUpload} />
        ))}
        {Array.from({ length: emptyCount }).map((_, i) => (
          <Slot
            key={`empty-${i}`}
            kind={kind}
            ideaId={ideaId}
            video={undefined}
            canUpload={canUpload}
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
  kind, ideaId, video, canUpload, disabledReason,
}: {
  kind: ContentIdeaVideoKind
  ideaId: string
  video: ContentIdeaVideo | undefined
  canUpload: boolean
  disabledReason?: string
}) {
  const meta = META[kind]
  const Icon = meta.icon
  const fileRef = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  async function handleFile(file: File | null) {
    if (!file) return
    if (file.size > 5 * 1024 * 1024 * 1024) {
      toast({ title: 'Muy grande', description: 'Máximo 5 GB', variant: 'destructive' })
      return
    }

    const slot = await getR2UploadUrl({ ideaId, kind, fileName: file.name, contentType: file.type || 'video/mp4' })
    if (slot.error || !slot.url || !slot.key) {
      toast({ title: 'Error', description: slot.error ?? 'No se pudo iniciar la subida', variant: 'destructive' })
      return
    }

    setProgress(0)
    try {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('PUT', slot.url!, true)
        xhr.setRequestHeader('Content-Type', file.type || 'video/mp4')
        xhr.upload.onprogress = (e) => { if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100)) }
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`R2 ${xhr.status}`)))
        xhr.onerror = () => reject(new Error('Error de red durante la subida'))
        xhr.send(file)
      })
      startTransition(async () => {
        const res = await registerR2Video({
          ideaId, kind, key: slot.key!, name: file.name, sizeBytes: file.size, mimeType: file.type || 'video/mp4',
        })
        setProgress(null)
        if (res.error) toast({ title: 'Error', description: res.error, variant: 'destructive' })
        else toast({ title: `${meta.label} subido` })
      })
    } catch (err) {
      setProgress(null)
      toast({ title: 'Falló la subida', description: err instanceof Error ? err.message : 'Error', variant: 'destructive' })
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
      <div className={cn('flex items-center gap-3 rounded-lg border p-3', meta.tone)}>
        <div className={cn('grid h-11 w-14 shrink-0 place-items-center rounded', meta.tone)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide">
            <Icon className="h-3 w-3" /> {meta.label}
          </p>
          <p className="truncate text-sm font-medium">{video.name}</p>
          <p className="text-xs text-muted-foreground">{formatBytes(video.size_bytes)}{isR2 ? ' · R2' : ''}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
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
          <span className="flex items-center gap-1.5"><Icon className="h-3.5 w-3.5" /> Subiendo {meta.label.toLowerCase()}…</span>
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
        handleFile(e.dataTransfer.files?.[0] ?? null)
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
        <p className="text-[10px] text-muted-foreground">{disabledReason ?? meta.sub} · arrastra o haz click</p>
      </div>
      <Upload className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:scale-110 group-hover:text-primary" />
      <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
    </button>
  )
}
