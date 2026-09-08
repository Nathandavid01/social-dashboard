'use client'

import { RoleGate } from '@/components/auth/role-gate'
import { useState, useTransition } from 'react'
import { Sparkles, Loader2, Download, ExternalLink, ImagePlus, X, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ClientCombobox } from '@/components/clients/client-combobox'
import { useToast } from '@/lib/hooks/use-toast'
import { createClient } from '@/lib/supabase/client'
import { generateClientGraphics, enhanceGraphicConcept, type GeneratedGraphicResult } from '@/lib/actions/graphics'
import { GRAPHIC_ASPECT_RATIOS } from '@/lib/llm/image-llm-core'
import type { GeneratedGraphicRow } from '@/lib/supabase/types'

export interface GraphicClient {
  id: string
  name: string
}

function formatDate(s: string): string {
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleDateString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

/** Grid cell aspect per ratio so previews keep their real proportions. */
const ASPECT_CLASS: Record<string, string> = {
  '1:1': 'aspect-square',
  '3:4': 'aspect-[3/4]',
  '9:16': 'aspect-[9/16]',
  '16:9': 'aspect-video',
}

export function GraphicGenerator({
  clients,
  history,
}: {
  clients: GraphicClient[]
  history: GeneratedGraphicRow[]
}) {
  const { toast } = useToast()
  const [clientId, setClientId] = useState('')
  const [concept, setConcept] = useState('')
  const [aspectRatio, setAspectRatio] = useState<string>('1:1')
  const [count, setCount] = useState('2')
  const [results, setResults] = useState<GeneratedGraphicResult[]>([])
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [isGenerating, startGenerate] = useTransition()
  const [isEnhancing, startEnhance] = useTransition()

  function pickPhoto(file: File | null) {
    if (photoPreview) URL.revokeObjectURL(photoPreview)
    setPhoto(file)
    setPhotoPreview(file ? URL.createObjectURL(file) : null)
    setUploadedUrl(null)
  }

  // Con foto propia: subirla al bucket público y pasar la URL (evita el límite
  // de body de las server actions con fotos grandes). Se sube una sola vez —
  // Mejorar descripción y Generar reutilizan la misma URL.
  async function ensurePhotoUploaded(): Promise<{ url: string | null } | { error: string }> {
    if (!photo) return { url: null }
    if (uploadedUrl) return { url: uploadedUrl }
    setUploadingPhoto(true)
    try {
      const supabase = createClient()
      const ext = (photo.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
      const path = `generated-graphics/refs/${clientId}/${Date.now()}.${ext}`
      const { error } = await supabase.storage
        .from('client-assets')
        .upload(path, photo, { contentType: photo.type || 'image/jpeg', cacheControl: '3600' })
      if (error) throw new Error(error.message)
      const url = supabase.storage.from('client-assets').getPublicUrl(path).data.publicUrl
      setUploadedUrl(url)
      return { url }
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Error de subida' }
    } finally {
      setUploadingPhoto(false)
    }
  }

  function enhance() {
    startEnhance(async () => {
      const up = await ensurePhotoUploaded()
      if ('error' in up) {
        toast({ title: 'No se pudo subir la foto', description: up.error, variant: 'destructive' })
        return
      }
      const res = await enhanceGraphicConcept({ clientId, concept, referenceImageUrl: up.url })
      if (res.error) {
        toast({ title: 'No se pudo mejorar', description: res.error, variant: 'destructive' })
      } else if (res.concept) {
        setConcept(res.concept)
        toast({ title: 'Descripción mejorada', description: 'Revísala y edítala antes de generar.' })
      }
    })
  }

  function generate() {
    startGenerate(async () => {
      const up = await ensurePhotoUploaded()
      if ('error' in up) {
        toast({ title: 'No se pudo subir la foto', description: up.error, variant: 'destructive' })
        return
      }
      const referenceImageUrl = up.url

      const res = await generateClientGraphics({
        clientId,
        concept,
        aspectRatio,
        count: Number(count),
        referenceImageUrl,
      })
      if (res.error) {
        toast({ title: 'No se pudo generar', description: res.error, variant: 'destructive' })
      } else if (res.images) {
        setResults(res.images)
        toast({
          title: res.images.length === 1 ? 'Gráfica generada' : `${res.images.length} gráficas generadas`,
          description: 'Quedaron guardadas en el historial de abajo.',
        })
      }
    })
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <CardTitle className="min-w-0 truncate text-base">Nueva gráfica</CardTitle>
          <RoleGate perm="graphics.cost.read"><span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">~$0.04 por imagen</span></RoleGate>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-xs text-muted-foreground sm:col-span-1">
              Cliente
              <ClientCombobox clients={clients} value={clientId} onChange={setClientId} placeholder="Escribe o elige cliente" />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Formato
              <Select value={aspectRatio} onValueChange={setAspectRatio} disabled={!!photo}>
                <SelectTrigger className="h-9 text-sm">
                  {photo ? <span className="text-muted-foreground">Lo define tu foto</span> : <SelectValue />}
                </SelectTrigger>
                <SelectContent>
                  {GRAPHIC_ASPECT_RATIOS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Variantes
              <Select value={count} onValueChange={setCount}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['1', '2', '3', '4'].map((n) => (
                    <SelectItem key={n} value={n}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          </div>

          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            ¿Qué debe mostrar? (para la IA)
            <Textarea
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              rows={3}
              placeholder="Ej: promo 2x1 en cortes este fin de semana, ambiente de barbería moderna…"
              className="resize-none text-sm"
            />
          </label>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">
              Foto propia (opcional — la IA la convierte en el arte)
            </span>
            {photo ? (
              <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  {photoPreview && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photoPreview} alt="Foto de referencia" className="h-9 w-9 shrink-0 rounded object-cover" />
                  )}
                  <span className="truncate">{photo.name}</span>
                </span>
                <button
                  type="button"
                  onClick={() => pickPhoto(null)}
                  aria-label="Quitar foto"
                  className="shrink-0 text-muted-foreground transition hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted/40 hover:text-foreground">
                <ImagePlus className="h-4 w-4 shrink-0" />
                Subir foto (la que tiraron en el shoot)
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => pickPhoto(e.target.files?.[0] ?? null)}
                />
              </label>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={enhance}
              disabled={isEnhancing || isGenerating || !clientId || !concept.trim()}
              className="transition-transform hover:scale-105"
              title={photo ? 'Grok mira tu foto y escribe la descripción' : 'Grok enriquece tu idea con la marca del cliente'}
            >
              {isEnhancing ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Wand2 className="mr-1.5 h-3.5 w-3.5" />
              )}
              {isEnhancing ? 'Mejorando…' : 'Mejorar descripción'}
            </Button>
            <Button
              size="sm"
              onClick={generate}
              disabled={isGenerating || isEnhancing || !clientId || !concept.trim()}
              className="transition-transform hover:scale-105"
            >
              {isGenerating ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              )}
              {uploadingPhoto ? 'Subiendo foto…' : isGenerating ? 'Generando…' : 'Generar con IA'}
            </Button>
          </div>

          {results.length > 0 && (
            <div className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-4">
              {results.map((img, i) => (
                <div key={img.url} className="group space-y-1.5">
                  <div className={`overflow-hidden rounded-md border ${ASPECT_CLASS[aspectRatio] ?? 'aspect-square'}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt={`Gráfica ${i + 1}`} className="h-full w-full object-cover" />
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <a
                      href={img.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-muted-foreground transition hover:text-foreground"
                    >
                      <ExternalLink className="h-3 w-3" /> Abrir
                    </a>
                    <a
                      href={img.url}
                      download
                      className="inline-flex items-center gap-1 text-muted-foreground transition hover:text-foreground"
                    >
                      <Download className="h-3 w-3" /> Descargar
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historial</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aún no hay gráficas generadas. Las que generes quedarán guardadas aquí para todo el equipo.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {history.map((g) => (
                <a
                  key={g.id}
                  href={g.image_url}
                  target="_blank"
                  rel="noreferrer"
                  className="group space-y-1"
                  title={g.concept}
                >
                  <div className={`overflow-hidden rounded-md border ${ASPECT_CLASS[g.aspect_ratio] ?? 'aspect-square'}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={g.image_url}
                      alt={g.concept}
                      loading="lazy"
                      className="h-full w-full object-cover transition group-hover:scale-105"
                    />
                  </div>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {g.client?.name ? `${g.client.name} · ` : ''}
                    {formatDate(g.created_at)}
                  </p>
                </a>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
