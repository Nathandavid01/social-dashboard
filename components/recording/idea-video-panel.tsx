'use client'

import { useState, useTransition } from 'react'
import { Video, Scissors, Upload, ExternalLink, Trash2, Loader2, Camera, Clapperboard, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { useToast } from '@/lib/hooks/use-toast'
import { useHasPermission } from '@/components/auth/role-gate'
import { registerIdeaVideoFromLink, deleteIdeaVideo } from '@/lib/actions/idea-videos'
import { cn } from '@/lib/utils'
import type { ContentIdeaVideo, ContentIdeaVideoKind } from '@/lib/supabase/types'

interface Props {
  ideaId: string
  ideaTitle?: string
  videos: ContentIdeaVideo[]
  /** Compact rendering for embedding in cards. */
  compact?: boolean
}

export function IdeaVideoPanel({ ideaId, ideaTitle, videos, compact }: Props) {
  const canUpload = useHasPermission('video.upload')
  const raw = videos.find((v) => v.kind === 'raw' && v.status === 'uploaded')
  const edited = videos.find((v) => v.kind === 'edited' && v.status === 'uploaded')

  return (
    <div className={cn('space-y-2', compact ? '' : 'space-y-3')}>
      <VideoSlot
        kind="raw"
        ideaId={ideaId}
        ideaTitle={ideaTitle}
        video={raw}
        canUpload={canUpload}
        compact={compact}
      />
      <VideoSlot
        kind="edited"
        ideaId={ideaId}
        ideaTitle={ideaTitle}
        video={edited}
        canUpload={canUpload}
        compact={compact}
        /* Editor pipeline is unlocked once raw exists */
        disabledReason={!raw ? 'Sube el video crudo primero' : undefined}
      />
    </div>
  )
}

const SLOT_META: Record<ContentIdeaVideoKind, { label: string; sub: string; icon: typeof Camera; tone: string }> = {
  raw: {
    label: 'Video crudo',
    sub: 'Material recién grabado, listo para editar',
    icon: Camera,
    tone: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/30',
  },
  edited: {
    label: 'Video editado',
    sub: 'Versión final para QC y publicación',
    icon: Clapperboard,
    tone: 'text-purple-500 bg-purple-500/10 border-purple-500/30',
  },
}

function VideoSlot({
  kind, ideaId, ideaTitle, video, canUpload, compact, disabledReason,
}: {
  kind: ContentIdeaVideoKind
  ideaId: string
  ideaTitle?: string
  video: ContentIdeaVideo | undefined
  canUpload: boolean
  compact?: boolean
  disabledReason?: string
}) {
  const meta = SLOT_META[kind]
  const Icon = meta.icon
  const [isDeleting, startDelete] = useTransition()
  const { toast } = useToast()

  if (video) {
    return (
      <div className={cn('flex items-center gap-3 rounded-lg border p-3', meta.tone)}>
        {video.drive_thumb_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={video.drive_thumb_url} alt="" className="h-12 w-16 shrink-0 rounded object-cover" />
        ) : (
          <div className={cn('grid h-12 w-16 shrink-0 place-items-center rounded', meta.tone)}>
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
            <Icon className="h-3 w-3" />
            {meta.label}
          </p>
          <p className="truncate text-sm font-medium">{video.name}</p>
          {video.notes && <p className="truncate text-xs text-muted-foreground">{video.notes}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {video.drive_view_link && (
            <a
              href={video.drive_view_link}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-xs font-medium hover:bg-accent"
            >
              <ExternalLink className="h-3 w-3" /> Drive
            </a>
          )}
          {canUpload && (
            <button
              onClick={() => {
                if (!confirm(`¿Quitar este ${meta.label.toLowerCase()}?`)) return
                startDelete(async () => {
                  const res = await deleteIdeaVideo(video.id)
                  if (res.error) toast({ title: 'Error', description: res.error, variant: 'destructive' })
                  else toast({ title: 'Video archivado' })
                })
              }}
              className="rounded-md p-1.5 text-muted-foreground hover:text-destructive"
              disabled={isDeleting}
              aria-label="Eliminar"
            >
              {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
      </div>
    )
  }

  // Empty state — show upload CTA
  if (!canUpload) {
    return (
      <div className={cn('rounded-lg border border-dashed p-3 text-xs text-muted-foreground', compact && 'p-2')}>
        <div className="flex items-center gap-2 opacity-70">
          <Icon className="h-3.5 w-3.5" /> {meta.label} pendiente
        </div>
      </div>
    )
  }

  return (
    <UploadDialog
      ideaId={ideaId}
      ideaTitle={ideaTitle}
      kind={kind}
      compact={compact}
      disabledReason={disabledReason}
    />
  )
}

function UploadDialog({
  ideaId, ideaTitle, kind, compact, disabledReason,
}: {
  ideaId: string
  ideaTitle?: string
  kind: ContentIdeaVideoKind
  compact?: boolean
  disabledReason?: string
}) {
  const meta = SLOT_META[kind]
  const Icon = meta.icon
  const [open, setOpen] = useState(false)
  const [link, setLink] = useState('')
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  function submit() {
    startTransition(async () => {
      const res = await registerIdeaVideoFromLink({
        ideaId,
        kind,
        driveLink: link,
        name: name || undefined,
        notes: notes || undefined,
      })
      if (res.error) toast({ title: 'Error', description: res.error, variant: 'destructive' })
      else {
        toast({ title: `${meta.label} registrado` })
        setOpen(false)
        setLink('')
        setName('')
        setNotes('')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          disabled={!!disabledReason}
          className={cn(
            'group flex w-full items-center gap-2 rounded-lg border border-dashed p-3 text-left text-sm transition-all',
            'hover:border-primary hover:bg-primary/5',
            disabledReason && 'cursor-not-allowed opacity-50 hover:border-dashed hover:bg-transparent',
            compact && 'p-2 text-xs',
          )}
        >
          <div className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-md', meta.tone)}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium">Subir {meta.label.toLowerCase()}</p>
            <p className="text-[10px] text-muted-foreground">{disabledReason ?? meta.sub}</p>
          </div>
          <Upload className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:scale-110 group-hover:text-primary" />
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {kind === 'raw' ? <Video className="h-5 w-5" /> : <Scissors className="h-5 w-5" />}
            Subir {meta.label.toLowerCase()}
            {ideaTitle && <span className="text-muted-foreground text-sm font-normal">— {ideaTitle}</span>}
          </DialogTitle>
          <DialogDescription>
            Sube tu archivo a Google Drive (cualquier carpeta) y pega aquí el link compartible.
            La calidad del archivo se preserva intacta porque la app solo guarda la referencia.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="drive_link" className="text-xs">Link de Google Drive *</Label>
            <Input
              id="drive_link"
              autoFocus
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://drive.google.com/file/d/…"
              className="h-9 font-mono text-xs"
            />
            <p className="text-[10px] text-muted-foreground">
              Acepta el link compartible (.../file/d/&lt;id&gt;/view), el link de descarga, o solo el file ID.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vname" className="text-xs">Nombre (opcional)</Label>
            <Input
              id="vname"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={kind === 'raw' ? 'Reel VSS Properties — Tomas crudas' : 'Reel VSS Properties — Final v1'}
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vnotes" className="text-xs">Notas para el {kind === 'raw' ? 'editor' : 'revisor'}</Label>
            <Textarea
              id="vnotes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder={kind === 'raw' ? 'Cortar primeros 8s, usar la toma del balcón al final…' : 'Cambios aplicados, listo para publicar…'}
              className="resize-none text-sm"
            />
          </div>
          {kind === 'raw' && (
            <div className="flex items-start gap-2 rounded-md border border-blue-500/30 bg-blue-500/5 p-2 text-xs text-blue-600 dark:text-blue-300">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <p>Al guardar, la idea pasa automáticamente a estado <strong>grabada</strong> y queda disponible para el editor.</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>Cancelar</Button>
          <Button onClick={submit} disabled={!link.trim() || isPending}>
            {isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-2 h-3.5 w-3.5" />}
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
