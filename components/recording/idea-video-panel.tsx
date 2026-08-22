'use client'

import { useRef, useState, useTransition } from 'react'
import { Video, Plus, Download, Trash2, Loader2, Camera, Clapperboard, ExternalLink, Play, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ToastAction } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import { useToast } from '@/lib/hooks/use-toast'
import { useHasPermission, useHasAnyPermission, useCurrentUserId } from '@/components/auth/role-gate'
import { getR2DownloadUrl, deleteR2Video, restoreR2Video } from '@/lib/actions/idea-videos-r2'
import { getVideoPreviewUrl } from '@/lib/actions/video-preview'
import { useUploadStore, type UploadItem } from '@/lib/stores/upload-store'
import { NateUploadLogo } from '@/components/uploads/nate-upload-logo'
import { uploadPhaseText } from '@/lib/utils/upload-phase-text'
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
  edited: { label: 'Video editado', sub: 'Versión final para QC',               icon: Clapperboard, tone: 'text-purple-500 bg-purple-500/10 border-purple-500/30' },
  raw:    { label: 'Video crudo',   sub: 'Material grabado, listo para editar', icon: Camera,       tone: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/30' },
  broll:  { label: 'B-roll',        sub: 'Tomas de apoyo',                      icon: Video,        tone: 'text-teal-500 bg-teal-500/10 border-teal-500/30' },
}

/** Order the deliverable first: editado (entrega) → crudo (insumo) → b-roll. */
const KIND_ORDER: ContentIdeaVideoKind[] = ['edited', 'raw', 'broll']

/** Exact aria-labels for the "+" trigger per slot (raw reads "material", not "video"). */
const ADD_LABEL: Record<ContentIdeaVideoKind, string> = {
  edited: 'Añadir video editado',
  raw: 'Añadir material crudo',
  broll: 'Añadir b-roll',
}

const MONTH_SHORT_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'] as const

function formatBytes(n: number | null): string {
  if (!n) return ''
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`
}

/** Full upload time, e.g. "2 jun, 3:42 p. m." — kept as the hover `title`. */
function formatUploadedAt(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('es-PR', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true })
}

/** Short date for the visible row, e.g. "3 ago" — no time, no year. */
function formatUploadedAtShort(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getDate()} ${MONTH_SHORT_ES[d.getMonth()]}`
}

/** First name only, e.g. "Nathan Torres" → "Nathan" — the row stays scannable. */
function firstName(fullName: string | null | undefined): string {
  const t = fullName?.trim()
  return t ? t.split(/\s+/)[0] : ''
}

const REQUIRED_FILES: Partial<Record<ContentIdeaVideoKind, number>> = { raw: 4, edited: 1 }

export function IdeaVideoPanel({ ideaId, ideaTitle, videos, publicEnabled = false }: Props) {
  const canUpload = useHasPermission('video.upload')
  // Same read gate as the server actions (getR2DownloadUrl/PreviewUrl/PublicUrl):
  // revision/entregas/planning read lets you manage ANY client's material.
  // Without it, "Ver"/"Bajar" only apply to what THIS user uploaded — computed
  // per-row below via ownUploadUserId, no per-row fetch.
  const canManageVideos = useHasAnyPermission(['revision.read', 'entregas.read', 'planning.read'])
  const ownUploadUserId = useCurrentUserId()
  const uploaded = videos.filter((v) => v.status === 'uploaded')
  const byKind: Record<ContentIdeaVideoKind, ContentIdeaVideo[]> = {
    edited: uploaded.filter((v) => v.kind === 'edited'),
    raw: uploaded.filter((v) => v.kind === 'raw'),
    broll: uploaded.filter((v) => v.kind === 'broll'),
  }
  const hasRaw = byKind.raw.length > 0

  return (
    <div className="space-y-5">
      {KIND_ORDER.map((kind) => (
        <SlotGroup
          key={kind}
          kind={kind}
          ideaId={ideaId}
          ideaTitle={ideaTitle}
          videos={byKind[kind]}
          canUpload={canUpload}
          canManageVideos={canManageVideos}
          ownUploadUserId={ownUploadUserId}
          publicEnabled={publicEnabled}
          disabledReason={kind === 'edited' && !hasRaw ? 'Sube el video crudo primero' : undefined}
        />
      ))}
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
  const storageLabel = video.storage_provider === 'entregas-r2'
    ? 'Entregas R2'
    : video.storage_provider === 'r2'
      ? 'R2'
      : video.storage_provider === 'supabase'
        ? 'Supabase'
        : 'Drive'
  const pill = 'rounded border px-1.5 py-0.5 text-[10px] font-medium'
  return (
    <span className="mt-1 flex flex-wrap items-center gap-1">
      <span className={cn(pill, badge.cls)}>{badge.label}</span>
      <span className={cn(pill, 'bg-muted text-muted-foreground border-border')}>{storageLabel}</span>
      {isPublic && (
        <span className={cn(pill, 'bg-purple-500/15 text-purple-600 border-purple-500/30')}>Público</span>
      )}
    </span>
  )
}

/**
 * One video group (edited/raw/broll): a compact header — icon, label, count,
 * requirement badge, and a "+" trigger — plus the file rows. No big dropzone
 * box; the whole group is still a drop target so drag-and-drop keeps working.
 */
function SlotGroup({
  kind, ideaId, ideaTitle, videos, canUpload, canManageVideos, ownUploadUserId, publicEnabled, disabledReason,
}: {
  kind: ContentIdeaVideoKind
  ideaId: string
  ideaTitle?: string
  videos: ContentIdeaVideo[]
  canUpload: boolean
  canManageVideos: boolean
  ownUploadUserId: string | null
  publicEnabled: boolean
  disabledReason?: string
}) {
  const meta = META[kind]
  const Icon = meta.icon
  const required = REQUIRED_FILES[kind]

  // Optimistic hide on delete: the row leaves the list instantly, before the
  // server call resolves. "Deshacer" (in FileRow's toast) just removes the id
  // again — the row was archived, never destroyed, so restoring is cheap.
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set())
  const visibleVideos = videos.filter((v) => !hiddenIds.has(v.id))
  const hideVideo = (id: string) => setHiddenIds((s) => new Set(s).add(id))
  const showVideo = (id: string) => setHiddenIds((s) => {
    if (!s.has(id)) return s
    const next = new Set(s)
    next.delete(id)
    return next
  })

  const missing = required == null ? 0 : Math.max(0, required - visibleVideos.length)
  const uploadedLabel = `${visibleVideos.length} ${visibleVideos.length === 1 ? 'subido' : 'subidos'}`
  const requirementLabel = required == null
    ? 'Opcional'
    : missing > 0
      ? `Faltan ${missing}`
      : 'Completo'

  const fileRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [myUploadIds, setMyUploadIds] = useState<string[]>([])
  const { toast } = useToast()
  const startUpload = useUploadStore((s) => s.startUpload)
  const allUploads = useUploadStore((s) => s.uploads)
  // Uploads THIS group started, still tracked in the store — the engine keeps
  // running even if this component unmounts; we just stop listening to it.
  const myUploads = myUploadIds.map((id) => allUploads[id]).filter((u): u is UploadItem => !!u)

  const canDrop = canUpload && !disabledReason

  const MAX_BYTES = 5 * 1024 * 1024 * 1024

  function waitForUploadDone(id: string): Promise<UploadItem> {
    const isDone = (item: UploadItem) => item.phase === 'listo' || item.phase === 'error' || item.phase === 'cancelado'
    const now = useUploadStore.getState().uploads[id]
    if (now && isDone(now)) return Promise.resolve(now)
    return new Promise((resolve) => {
      const unsub = useUploadStore.subscribe((state) => {
        const item = state.uploads[id]
        if (item && isDone(item)) {
          unsub()
          resolve(item)
        }
      })
    })
  }

  // Accepts one OR many files; each starts its own resilient upload in the
  // global store (survives navigating away). We just wait here to summarize.
  async function handleFiles(files: FileList | File[] | null) {
    const list = Array.from(files ?? [])
    if (list.length === 0) return
    const ok = list.filter((f) => f.size <= MAX_BYTES)
    if (ok.length < list.length) {
      toast({ title: 'Algunos archivos son muy grandes', description: 'Máximo 5 GB por archivo', variant: 'destructive' })
    }
    if (ok.length === 0) return

    const ids = ok.map((file) => startUpload({ file, ideaId, kind, provider: 'r2', title: ideaTitle }))
    setMyUploadIds((prev) => [...prev, ...ids])

    const results = await Promise.all(ids.map(waitForUploadDone))
    results.forEach((r) => {
      if (r.phase === 'error') {
        toast({ title: 'Falló una subida', description: r.error ?? 'Error', variant: 'destructive' })
      }
    })
    const done = results.filter((r) => r.phase === 'listo').length
    if (done > 0) {
      const label = meta.label.toLowerCase()
      toast({ title: done === 1 ? `${label} subido` : `${done} ${label}s subidos` })
    }
  }

  return (
    <div
      data-slot-group={kind}
      className={cn(
        'space-y-2 rounded-lg transition-colors',
        dragOver && 'outline outline-2 outline-offset-2 outline-primary/50',
      )}
      onDragOver={(e) => {
        if (!canDrop) return
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        if (!canDrop) return
        e.preventDefault()
        setDragOver(false)
        handleFiles(e.dataTransfer.files)
      }}
    >
      <div className="flex items-center justify-between gap-x-3">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <Icon className="h-3.5 w-3.5" /> {meta.label}
          <span className="tabular-nums font-normal normal-case text-muted-foreground/70">
            {uploadedLabel}
          </span>
        </p>
        <div className="flex shrink-0 items-center gap-1.5">
          {kind === 'raw' && visibleVideos.length > 0 && (
            <span className="rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground" title="En el pipeline, borrar el crudo lo destruye — se conserva a propósito.">
              Se conserva
            </span>
          )}
          <span
            className={cn(
              'rounded-full border px-2 py-0.5 text-[10px] font-medium',
              required == null
                ? 'border-border bg-muted/50 text-muted-foreground'
                : missing > 0
                  ? 'border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
            )}
          >
            {requirementLabel}
          </span>
          {canUpload && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={!!disabledReason}
              title={disabledReason ?? `${meta.sub} · arrastra o haz click`}
              aria-label={ADD_LABEL[kind]}
              className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-border text-muted-foreground transition hover:border-primary hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="video/*"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
      </div>

      {myUploads
        .filter((u) => u.phase !== 'listo' && u.phase !== 'cancelado')
        .map((u) => (
          <div key={u.id} className={cn('flex items-center gap-3 rounded-lg border p-3', meta.tone)}>
            <NateUploadLogo pct={u.pct} size={32} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{u.fileName}</p>
              <p className={cn('text-xs', u.phase === 'error' ? 'text-red-500' : 'text-muted-foreground')}>
                {uploadPhaseText(u)}
              </p>
            </div>
            {u.phase === 'error' ? (
              <button
                type="button"
                onClick={() => useUploadStore.getState().dismissUpload(u.id)}
                aria-label="Cerrar"
                className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => useUploadStore.getState().cancelUpload(u.id)}
                className="shrink-0 rounded-md border border-current/30 px-2 py-1 text-[10px] font-medium hover:border-current/60"
              >
                Cancelar
              </button>
            )}
          </div>
        ))}

      {visibleVideos.length > 0 && (
        <div className="space-y-2">
          {visibleVideos.map((v) => (
            <FileRow
              key={v.id}
              kind={kind}
              ideaId={ideaId}
              video={v}
              canUpload={canUpload}
              canSee={canManageVideos || (!!ownUploadUserId && v.uploaded_by === ownUploadUserId)}
              publicEnabled={publicEnabled}
              allowDelete={kind !== 'raw'}
              onHide={hideVideo}
              onShow={showVideo}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/** One uploaded file's row: preview / download / (maybe) delete + status. */
function FileRow({
  kind, ideaId, video, canUpload, canSee, publicEnabled, allowDelete, onHide, onShow,
}: {
  kind: ContentIdeaVideoKind
  ideaId: string
  video: ContentIdeaVideo
  canUpload: boolean
  /** Read gate (revision/entregas/planning) OR "I uploaded this myself". If
   * false, "Ver"/"Bajar" would only fail server-side — don't render them; a
   * button that always fails is worse than no button. */
  canSee: boolean
  publicEnabled: boolean
  allowDelete: boolean
  /** Optimistic hide/show — lifted to SlotGroup so the count in the header
   * (Faltan N / Completo) updates in lockstep with the card disappearing. */
  onHide: (id: string) => void
  onShow: (id: string) => void
}) {
  const meta = META[kind]
  const Icon = meta.icon
  const [isPending, startTransition] = useTransition()
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const { toast } = useToast()

  function requestDelete() {
    setConfirmOpen(true)
  }

  function confirmDelete() {
    setConfirmOpen(false)
    // Optimistic: the card disappears instantly, before the server call
    // resolves — archiving is reversible, so there is nothing risky about it.
    onHide(video.id)
    startTransition(async () => {
      const res = await deleteR2Video(video.id, ideaId)
      if (res.error) {
        onShow(video.id)
        toast({ title: 'Error', description: res.error, variant: 'destructive' })
        return
      }
      const t = toast({
        title: `${meta.label} eliminado`,
        description: 'Se puede deshacer por unos segundos. El archivo no se borra hasta pasados 7 días.',
        action: (
          <ToastAction
            altText="Deshacer"
            onClick={() => {
              onShow(video.id)
              startTransition(async () => {
                const undo = await restoreR2Video(video.id, ideaId)
                if (undo.error) {
                  // The archive already happened server-side; keep the row
                  // hidden rather than show a video that failed to restore.
                  onHide(video.id)
                  toast({ title: 'No se pudo deshacer', description: undo.error, variant: 'destructive' })
                }
              })
            }}
          >
            Deshacer
          </ToastAction>
        ),
      })
      setTimeout(() => t.dismiss?.(), 8000)
    })
  }

  async function togglePreview() {
    if (previewUrl) {
      setPreviewUrl(null)
      return
    }
    setPreviewLoading(true)
    // Routes by storage_provider so pipeline r2 AND entregas-r2 remain viewable.
    const res = await getVideoPreviewUrl(video.id)
    setPreviewLoading(false)
    if (res.error || !res.url) {
      toast({ title: 'Error', description: res.error ?? 'No se pudo cargar el preview', variant: 'destructive' })
      return
    }
    setPreviewUrl(res.url)
  }

  async function download() {
    const res = await getR2DownloadUrl(video.id)
    if (res.error) toast({ title: 'Error', description: res.error, variant: 'destructive' })
    else if (res.url) window.open(res.url, '_blank')
  }

  // Both pipeline R2 and Entregas R2 support signed preview via getVideoPreviewUrl.
  // Download still uses pipeline R2 signer (old-bucket rows only); entregas uses preview URL as fallback for now.
  const isCloudR2 = video.storage_provider === 'r2' || video.storage_provider === 'entregas-r2'
  const canDownloadR2 = video.storage_provider === 'r2'

  const uploaderFirst = firstName(video.uploader?.full_name)
  const shortDate = formatUploadedAtShort(video.uploaded_at)
  const shortMeta = [formatBytes(video.size_bytes), uploaderFirst, shortDate].filter(Boolean).join(' · ')
  const fullMeta = [
    formatBytes(video.size_bytes),
    video.uploader?.full_name?.trim() ? `subido por ${video.uploader.full_name.trim()}` : '',
    video.uploaded_at ? formatUploadedAt(video.uploaded_at) : '',
  ].filter(Boolean).join(' · ')

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
          <p className="text-xs text-muted-foreground" title={fullMeta}>{shortMeta}</p>
          <VideoStatusBadges video={video} kind={kind} publicEnabled={publicEnabled} />
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {isCloudR2 && canSee && (
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
          {canDownloadR2 && canSee ? (
            <Button size="sm" variant="outline" onClick={download}>
              <Download className="mr-1 h-3.5 w-3.5" /> Bajar
            </Button>
          ) : video.drive_view_link ? (
            <a href={video.drive_view_link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-xs hover:bg-accent">
              <ExternalLink className="h-3 w-3" /> Drive
            </a>
          ) : null}
          {canUpload && allowDelete && (
            <button
              onClick={requestDelete}
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
      {canUpload && allowDelete && (
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title={`¿Eliminar este ${meta.label.toLowerCase()}?`}
          description={`Se quita "${video.name}" de este video. Se puede deshacer por unos segundos después de confirmar; pasados 7 días sin deshacer, el archivo se borra.`}
          confirmLabel="Eliminar"
          destructive
          onConfirm={confirmDelete}
        />
      )}
    </div>
  )
}
