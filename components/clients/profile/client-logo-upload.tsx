'use client'

import { useRef, useState, useTransition } from 'react'
import { Camera, Loader2, Sun, Moon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/lib/hooks/use-toast'
import { uploadClientLogo } from '@/lib/actions/client-profile'
import { cn } from '@/lib/utils'

interface Props {
  clientId: string
  currentLogoUrl: string | null
  currentLogoDarkUrl: string | null
  clientName: string
}

export function ClientLogoUpload({ clientId, currentLogoUrl, currentLogoDarkUrl, clientName }: Props) {
  const [variant, setVariant] = useState<'light' | 'dark'>('light')
  const [optimisticUrl, setOptimisticUrl] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const url = optimisticUrl ?? (variant === 'dark' ? currentLogoDarkUrl : currentLogoUrl)
  const initials = clientName
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  function handleFile(file: File | null) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Tipo inválido', description: 'Solo imágenes (PNG, JPG, SVG…)', variant: 'destructive' })
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Archivo grande', description: 'Máximo 5 MB', variant: 'destructive' })
      return
    }
    // optimistic preview
    const preview = URL.createObjectURL(file)
    setOptimisticUrl(preview)

    const fd = new FormData()
    fd.append('file', file)
    fd.append('variant', variant)
    startTransition(async () => {
      const res = await uploadClientLogo(clientId, fd)
      if (res.error) {
        toast({ title: 'Error al subir logo', description: res.error, variant: 'destructive' })
        setOptimisticUrl(null)
      } else if (res.url) {
        setOptimisticUrl(res.url)
        toast({ title: 'Logo actualizado', description: `Variante ${variant === 'dark' ? 'oscura' : 'clara'}` })
      }
    })
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          e.currentTarget.classList.add('ring-2', 'ring-primary')
        }}
        onDragLeave={(e) => e.currentTarget.classList.remove('ring-2', 'ring-primary')}
        onDrop={(e) => {
          e.preventDefault()
          e.currentTarget.classList.remove('ring-2', 'ring-primary')
          handleFile(e.dataTransfer.files?.[0] ?? null)
        }}
        onClick={() => fileRef.current?.click()}
        className={cn(
          'group relative grid h-20 w-20 cursor-pointer place-items-center overflow-hidden rounded-2xl border bg-muted/50 transition-all sm:h-24 sm:w-24 md:h-28 md:w-28',
          'hover:border-primary/60 hover:bg-muted',
          isPending && 'pointer-events-none',
        )}
        role="button"
        aria-label="Subir logo"
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={`${clientName} logo`}
            className="h-full w-full object-contain p-2 transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <span className="text-2xl font-bold text-muted-foreground md:text-3xl">{initials || '?'}</span>
        )}

        <div className={cn(
          'absolute inset-0 grid place-items-center bg-background/70 opacity-0 transition-opacity duration-200',
          'group-hover:opacity-100',
          isPending && 'opacity-100',
        )}>
          {isPending ? (
            <Loader2 className="h-6 w-6 animate-spin text-foreground" />
          ) : (
            <Camera className="h-6 w-6 text-foreground" />
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
      </div>

      <div className="flex gap-1">
        <Button
          variant={variant === 'light' ? 'default' : 'ghost'}
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => {
            setVariant('light')
            setOptimisticUrl(null)
          }}
          aria-label="Logo claro"
          type="button"
        >
          <Sun className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant={variant === 'dark' ? 'default' : 'ghost'}
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => {
            setVariant('dark')
            setOptimisticUrl(null)
          }}
          aria-label="Logo oscuro"
          type="button"
        >
          <Moon className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
