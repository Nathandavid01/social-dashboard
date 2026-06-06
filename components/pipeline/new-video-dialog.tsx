'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Lightbulb, Clapperboard } from 'lucide-react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useToast } from '@/lib/hooks/use-toast'
import { createContentIdeaManual } from '@/lib/actions/content-ideas'
import { createRecordedVideo } from '@/lib/actions/recorded-video'
import { generateCaptionDraft } from '@/lib/actions/caption-draft'
import { RecordedVideoForm } from './recorded-video-form'
import type { ContentIdeaType } from '@/lib/supabase/types'

const TYPES: { value: ContentIdeaType; label: string }[] = [
  { value: 'R', label: 'Reel' },
  { value: 'P', label: 'Post' },
  { value: 'C', label: 'Carrusel' },
  { value: 'S', label: 'Story' },
]

type Path = 'idea' | 'recorded'

/**
 * "Nuevo video" — two intake paths:
 *  • Idea nueva     → creates a content_idea in the Idea/Title column (full pipeline)
 *  • Video ya grabado → classifies an already-recorded video straight into
 *    Video/Edited/Approval, attaching its raw clips + edited cut (Drive links).
 */
export function NewVideoDialog({
  clients,
  team = [],
}: {
  clients: { id: string; name: string }[]
  team?: { id: string; name: string }[]
}) {
  const [open, setOpen] = useState(false)
  const [path, setPath] = useState<Path>('idea')
  const [clientId, setClientId] = useState('')
  const [title, setTitle] = useState('')
  const [type, setType] = useState<ContentIdeaType>('R')
  const [pending, setPending] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  const canCreate = !!clientId && title.trim().length > 0 && !pending

  function reset() {
    setTitle(''); setClientId(''); setType('R'); setPath('idea')
  }

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
    reset()
    router.refresh()
  }

  function done() {
    setOpen(false)
    reset()
    router.refresh()
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="ml-1 inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-black transition hover:bg-primary/90"
      >
        <Plus className="h-3.5 w-3.5" /> Nuevo video
      </button>
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset() }}>
        <DialogContent className="dark max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuevo video</DialogTitle>
          </DialogHeader>

          {/* Path selector */}
          <div className="grid grid-cols-2 gap-2 rounded-lg border border-white/[0.08] bg-white/[0.02] p-1">
            <PathTab active={path === 'idea'} icon={Lightbulb} label="Idea nueva" onClick={() => setPath('idea')} />
            <PathTab active={path === 'recorded'} icon={Clapperboard} label="Video ya grabado" onClick={() => setPath('recorded')} />
          </div>

          {path === 'idea' ? (
            <>
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
            </>
          ) : (
            <div className="py-2">
              <RecordedVideoForm
                clients={clients}
                team={team}
                onCreate={createRecordedVideo}
                onGenerateCaption={generateCaptionDraft}
                onDone={done}
                onError={(msg) => toast({ title: 'No se pudo', description: msg, variant: 'destructive' })}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

function PathTab({ active, icon: Icon, label, onClick }: { active: boolean; icon: typeof Lightbulb; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition',
        active ? 'border border-white/20 bg-white/[0.06] text-foreground' : 'text-muted-foreground hover:bg-white/[0.03]',
      )}
    >
      <Icon className={cn('h-4 w-4', active && 'text-primary')} /> {label}
    </button>
  )
}
