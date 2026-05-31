'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Film, ImageIcon, LayoutGrid, Circle, Camera, Video, Download, Play, X, Loader2, Upload, ExternalLink,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useToast } from '@/lib/hooks/use-toast'
import { useHasPermission } from '@/components/auth/role-gate'
import { ClientLogo } from '@/components/clients/client-logo'
import { getR2DownloadUrl, getR2PreviewUrl, getR2UploadUrl, registerR2Video } from '@/lib/actions/idea-videos-r2'
import type { Client, ContentIdeaType, ContentIdeaVideo } from '@/lib/supabase/types'
import type { PipelineVideo } from '@/lib/actions/video-pipeline'

export interface EditQueueItem {
  video: PipelineVideo
  client: Pick<Client, 'id' | 'name' | 'logo_url'>
}

const TYPE_CFG: Record<ContentIdeaType, { label: string; icon: typeof Film; color: string }> = {
  R: { label: 'Reel', icon: Film, color: 'text-pink-600' },
  P: { label: 'Post', icon: ImageIcon, color: 'text-blue-600' },
  C: { label: 'Carrusel', icon: LayoutGrid, color: 'text-purple-600' },
  S: { label: 'Story', icon: Circle, color: 'text-amber-600' },
}
const ACTIVE: ReadonlySet<ContentIdeaVideo['status']> = new Set<ContentIdeaVideo['status']>([
  'uploading', 'uploaded', 'processing',
])
const MAX_BYTES = 5 * 1024 * 1024 * 1024

export function EditorVideoCard({ item }: { item: EditQueueItem }) {
  const { video, client } = item
  const type = TYPE_CFG[video.content_type] ?? TYPE_CFG.R
  const TypeIcon = type.icon
  const caption = video.generated_caption?.trim() || null
  const source = [...video.videos.raw, ...video.videos.broll].filter((v) => ACTIVE.has(v.status))

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 animate-in fade-in slide-in-from-bottom-1 duration-300">
      {/* Header */}
      <div className="flex items-start gap-2">
        <ClientLogo name={client.name} logoUrl={client.logo_url} className="h-7 w-7 text-[9px]" />
        <div className="min-w-0 flex-1">
          <Link href={`/produccion/idea/${video.id}`} className="block truncate text-sm font-semibold hover:text-primary">
            {video.title || 'Sin título'}
          </Link>
          <p className="truncate text-xs text-muted-foreground">{client.name}</p>
        </div>
        <Badge variant="outline" className={cn('shrink-0 gap-1 whitespace-nowrap text-[10px]', type.color)}>
          <TypeIcon className="h-3 w-3" /> {type.label}
        </Badge>
      </div>

      <p className={cn('line-clamp-2 text-xs', caption ? 'text-muted-foreground' : 'italic text-muted-foreground/50')}>
        {caption ?? 'Sin caption'}
      </p>

      {/* Source material to download */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Material a editar</p>
        {source.length === 0 ? (
          <p className="text-xs italic text-muted-foreground/60">Sin material</p>
        ) : (
          <div className="space-y-1.5">
            {source.map((v) => (
              <MaterialRow key={v.id} video={v} />
            ))}
          </div>
        )}
      </div>

      {/* Upload edited */}
      <EditedUploader ideaId={video.id} />
    </div>
  )
}

function MaterialRow({ video }: { video: ContentIdeaVideo }) {
  const { toast } = useToast()
  const isR2 = video.storage_provider === 'r2'
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const Icon = video.kind === 'broll' ? Video : Camera

  async function download() {
    if (!isR2) {
      if (video.drive_view_link) window.open(video.drive_view_link, '_blank')
      return
    }
    const res = await getR2DownloadUrl(video.id)
    if (res.error || !res.url) toast({ title: 'Error', description: res.error ?? 'No se pudo descargar', variant: 'destructive' })
    else window.open(res.url, '_blank')
  }

  async function togglePreview() {
    if (previewUrl) { setPreviewUrl(null); return }
    setLoading(true)
    const res = await getR2PreviewUrl(video.id)
    setLoading(false)
    if (res.error || !res.url) toast({ title: 'Error', description: res.error ?? 'No se pudo cargar', variant: 'destructive' })
    else setPreviewUrl(res.url)
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-2 py-1.5">
        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate text-xs">{video.name}</span>
        {isR2 && (
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={togglePreview} disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : previewUrl ? <X className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </Button>
        )}
        <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={download}>
          {isR2 ? <Download className="mr-1 h-3.5 w-3.5" /> : <ExternalLink className="mr-1 h-3.5 w-3.5" />} Bajar
        </Button>
      </div>
      {previewUrl && (
        <video src={previewUrl} controls playsInline className="aspect-video w-full rounded-md border bg-black" />
      )}
    </div>
  )
}

function EditedUploader({ ideaId }: { ideaId: string }) {
  const canUpload = useHasPermission('video.upload')
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const { toast } = useToast()
  const [progress, setProgress] = useState<number | null>(null)
  const [batch, setBatch] = useState<{ done: number; total: number } | null>(null)

  async function uploadOne(file: File) {
    const slot = await getR2UploadUrl({ ideaId, kind: 'edited', fileName: file.name, contentType: file.type || 'video/mp4' })
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
    const res = await registerR2Video({ ideaId, kind: 'edited', key: slot.key!, name: file.name, sizeBytes: file.size, mimeType: file.type || 'video/mp4' })
    if (res.error) throw new Error(res.error)
  }

  async function handleFiles(files: FileList | File[] | null) {
    const list = Array.from(files ?? [])
    const ok = list.filter((f) => f.size <= MAX_BYTES)
    if (ok.length < list.length) toast({ title: 'Algunos archivos son muy grandes', description: 'Máximo 5 GB por archivo', variant: 'destructive' })
    if (ok.length === 0) return
    let failed = 0
    for (let i = 0; i < ok.length; i++) {
      setBatch({ done: i, total: ok.length })
      setProgress(0)
      try { await uploadOne(ok[i]) } catch (err) {
        failed++
        toast({ title: 'Falló una subida', description: err instanceof Error ? err.message : 'Error', variant: 'destructive' })
      }
    }
    setBatch(null)
    setProgress(null)
    const done = ok.length - failed
    if (done > 0) { toast({ title: done === 1 ? 'Video editado subido' : `${done} videos editados subidos` }); router.refresh() }
  }

  if (!canUpload) return null

  if (progress !== null) {
    return (
      <div className="rounded-lg border border-purple-500/30 bg-purple-500/10 p-3">
        <div className="mb-2 flex items-center justify-between text-xs font-medium">
          <span>Subiendo editado…{batch && batch.total > 1 ? ` (${batch.done + 1} de ${batch.total})` : ''}</span>
          <span className="tabular-nums">{progress}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-background/60">
          <div className="h-full bg-purple-500 transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => fileRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-primary', 'bg-primary/5') }}
      onDragLeave={(e) => e.currentTarget.classList.remove('border-primary', 'bg-primary/5')}
      onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-primary', 'bg-primary/5'); handleFiles(e.dataTransfer.files) }}
      className="group flex w-full items-center gap-2 rounded-lg border border-dashed p-3 text-left text-sm transition-all hover:border-primary hover:bg-primary/5"
    >
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-purple-500/10 text-purple-600">
        <Upload className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium">Subir video editado</p>
        <p className="text-[10px] text-muted-foreground">Versión final · arrastra uno o varios o haz click</p>
      </div>
      <input ref={fileRef} type="file" accept="video/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
    </button>
  )
}
