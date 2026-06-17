'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/lib/hooks/use-toast'
import { platformLabels } from '@/lib/utils'
import { createContentIdeaManual } from '@/lib/actions/content-ideas'
import { PLATFORM_FORMATS, defaultFormatFor, defaultPlatformFormats } from '@/lib/utils/platform-formats'
import type { ContentIdeaType, SocialPlatform } from '@/lib/supabase/types'

const TYPES: { value: ContentIdeaType; label: string }[] = [
  { value: 'R', label: 'Reel' },
  { value: 'P', label: 'Post' },
  { value: 'C', label: 'Carrusel' },
  { value: 'S', label: 'Story' },
]

const NETWORKS: SocialPlatform[] = ['instagram', 'tiktok', 'facebook', 'linkedin']

/**
 * "Nuevo video" — creates a content_idea (lands in the Title/Idea column).
 *
 * `defaultClientId` pre-selects a client (used when opened from a client's batch
 * view). `onCreated` runs after a successful create — pass it so an in-place
 * overlay can refetch instead of relying on router.refresh(). `children`, when
 * given, replaces the default gold trigger button (so callers can style it).
 */
export function NewVideoDialog({
  clients,
  defaultClientId = '',
  onCreated,
  children,
}: {
  clients: { id: string; name: string }[]
  defaultClientId?: string
  onCreated?: () => void
  children?: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [clientId, setClientId] = useState(defaultClientId)
  const [title, setTitle] = useState('')
  const [type, setType] = useState<ContentIdeaType>('R')
  // Per-network format: a network present in the map = selected for this video.
  const [formats, setFormats] = useState<Record<string, string>>(() =>
    defaultPlatformFormats(['instagram', 'tiktok', 'facebook']),
  )
  const [pending, setPending] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  function toggleNetwork(p: SocialPlatform, on: boolean) {
    setFormats((f) => {
      const next = { ...f }
      if (on) next[p] = next[p] ?? defaultFormatFor(p)
      else delete next[p]
      return next
    })
  }

  const canCreate = !!clientId && title.trim().length > 0 && !pending

  async function create() {
    if (!canCreate) return
    setPending(true)
    const res = await createContentIdeaManual({ clientId, contentType: type, title: title.trim(), platformFormats: formats })
    setPending(false)
    if ('error' in res && res.error) {
      toast({ title: 'No se pudo crear', description: res.error, variant: 'destructive' })
      return
    }
    setOpen(false)
    setTitle('')
    setClientId(defaultClientId)
    if (onCreated) onCreated()
    else router.refresh()
  }

  return (
    <>
      {children ? (
        <span onClick={() => setOpen(true)} className="contents">
          {children}
        </span>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="ml-1 inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-black transition hover:bg-primary/90"
        >
          <Plus className="h-3.5 w-3.5" /> Nuevo video
        </button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo video</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Select value={clientId || undefined} onValueChange={setClientId}>
              <SelectTrigger aria-label="Cliente">
                <SelectValue placeholder="Cliente" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {clients.length === 0 ? (
                  <p className="px-2 py-1.5 text-sm text-muted-foreground">No hay clientes activos</p>
                ) : (
                  clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título del video" />
            <Select value={type} onValueChange={(v) => setType(v as ContentIdeaType)}>
              <SelectTrigger aria-label="Tipo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Formato por red — un mismo caption va a todas, el formato puede variar */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Formato por red</p>
              <div className="divide-y divide-border rounded-md border border-border">
                {NETWORKS.map((p) => {
                  const on = p in formats
                  return (
                    <div key={p} className="flex items-center justify-between gap-2 px-3 py-2">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={(e) => toggleNetwork(p, e.target.checked)}
                          aria-label={platformLabels[p]}
                        />
                        {platformLabels[p]}
                      </label>
                      {on ? (
                        <select
                          value={formats[p]}
                          onChange={(e) => setFormats((f) => ({ ...f, [p]: e.target.value }))}
                          aria-label={`Formato ${platformLabels[p]}`}
                          className="h-8 rounded-md border border-border bg-background px-2 text-xs"
                        >
                          {PLATFORM_FORMATS[p].map((f) => (
                            <option key={f.value} value={f.value}>{f.label}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={create} disabled={!canCreate}>{pending ? 'Creando…' : 'Crear'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
