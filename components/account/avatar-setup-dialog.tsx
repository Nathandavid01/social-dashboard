'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import { Shuffle, Upload, Loader2, Check, Sparkles } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useToast } from '@/lib/hooks/use-toast'
import { setAvatarUrl, uploadAvatar } from '@/lib/actions/avatar'
import { AVATAR_STYLES, dicebearUrl, avatarSeeds } from '@/lib/utils/avatar-core'

const GRID = 8

function randomSeed() {
  return Math.random().toString(36).slice(2, 9)
}

export function AvatarSetupDialog({
  open,
  onOpenChange,
  name,
  email,
  onLater,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  name: string
  email: string
  onLater?: () => void
  onSaved?: (url: string) => void
}) {
  const { toast } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<'generate' | 'upload'>('generate')
  const [style, setStyle] = useState(AVATAR_STYLES[0].id)
  const [seeds, setSeeds] = useState<string[]>(() => avatarSeeds(name || email || 'nate', GRID))
  const [selectedSeed, setSelectedSeed] = useState<string | null>(null)
  const [uploadPreview, setUploadPreview] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const options = useMemo(() => seeds.map((s) => ({ seed: s, url: dicebearUrl(style, s) })), [seeds, style])
  const selectedUrl = selectedSeed ? dicebearUrl(style, selectedSeed) : null

  function shuffle() {
    setSeeds(Array.from({ length: GRID }, randomSeed))
    setSelectedSeed(null)
  }

  function saveGenerated() {
    if (!selectedUrl) {
      toast({ title: 'Elige un avatar', description: 'Toca una de las opciones para seleccionarla.' })
      return
    }
    startTransition(async () => {
      const res = await setAvatarUrl(selectedUrl)
      if (res.error) toast({ title: 'Error', description: res.error, variant: 'destructive' })
      else {
        toast({ title: '¡Avatar listo!' })
        onSaved?.(selectedUrl)
        onOpenChange(false)
      }
    })
  }

  function handleFile(file: File | null) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Tipo inválido', description: 'Solo imágenes', variant: 'destructive' })
      return
    }
    if (file.size > 4 * 1024 * 1024) {
      toast({ title: 'Imagen grande', description: 'Máximo 4 MB', variant: 'destructive' })
      return
    }
    setUploadPreview(URL.createObjectURL(file))
    const fd = new FormData()
    fd.append('file', file)
    startTransition(async () => {
      const res = await uploadAvatar(fd)
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' })
        setUploadPreview(null)
      } else {
        toast({ title: '¡Foto lista!' })
        onSaved?.(res.url ?? '')
        onOpenChange(false)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Crea tu avatar
          </DialogTitle>
          <DialogDescription>
            Ponle cara a tu cuenta — elige un avatar generado o sube tu foto. Puedes hacerlo después.
          </DialogDescription>
        </DialogHeader>

        {/* Mode toggle */}
        <div className="inline-flex w-fit items-center gap-1 rounded-lg border bg-muted/40 p-1">
          {([
            ['generate', 'Generar'],
            ['upload', 'Subir foto'],
          ] as const).map(([m, label]) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                mode === m ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === 'generate' ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {AVATAR_STYLES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setStyle(s.id)
                    setSelectedSeed(null)
                  }}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                    style === s.id
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border text-muted-foreground hover:border-primary/40',
                  )}
                >
                  {s.label}
                </button>
              ))}
              <Button type="button" variant="ghost" size="sm" onClick={shuffle} className="ml-auto h-7">
                <Shuffle className="mr-1 h-3.5 w-3.5" /> Aleatorio
              </Button>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {options.map((o) => (
                <button
                  key={o.seed}
                  type="button"
                  onClick={() => setSelectedSeed(o.seed)}
                  className={cn(
                    'relative aspect-square overflow-hidden rounded-xl border-2 bg-muted transition-all',
                    selectedSeed === o.seed ? 'border-primary ring-2 ring-primary/20' : 'border-transparent hover:border-primary/40',
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={o.url} alt="" className="h-full w-full object-cover" />
                  {selectedSeed === o.seed && (
                    <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground">
                      <Check className="h-3 w-3" />
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-2">
            <div className="grid h-28 w-28 place-items-center overflow-hidden rounded-full border-2 border-dashed bg-muted">
              {uploadPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={uploadPreview} alt="" className="h-full w-full object-cover" />
              ) : (
                <Upload className="h-7 w-7 text-muted-foreground" />
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />
            <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={isPending}>
              <Upload className="mr-2 h-4 w-4" /> Elegir imagen
            </Button>
            <p className="text-xs text-muted-foreground">JPG o PNG, máximo 4 MB.</p>
          </div>
        )}

        <DialogFooter className="flex-row justify-between sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              onLater?.()
              onOpenChange(false)
            }}
            disabled={isPending}
          >
            Más tarde
          </Button>
          {mode === 'generate' && (
            <Button type="button" onClick={saveGenerated} disabled={isPending || !selectedSeed}>
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Guardar avatar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
