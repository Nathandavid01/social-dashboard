'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/lib/hooks/use-toast'
import { createContentIdeaManual } from '@/lib/actions/content-ideas'
import type { ContentIdeaType } from '@/lib/supabase/types'

const TYPES: { value: ContentIdeaType; label: string }[] = [
  { value: 'R', label: 'Reel' },
  { value: 'P', label: 'Post' },
  { value: 'C', label: 'Carrusel' },
  { value: 'S', label: 'Story' },
]

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
  const [pending, setPending] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  const canCreate = !!clientId && title.trim().length > 0 && !pending

  async function create() {
    if (!canCreate) return
    setPending(true)
    const res = await createContentIdeaManual({ clientId, contentType: type, title: title.trim() })
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
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger aria-label="Cliente">
                <SelectValue placeholder="Cliente" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
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
