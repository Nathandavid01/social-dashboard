'use client'

import { useId, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Upload } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/lib/hooks/use-toast'
import { useUploadStore } from '@/lib/stores/upload-store'
import { createBankIdea, ensureClientBrollLibrary } from '@/lib/actions/banco-direct-upload'
import {
  attachableBankIdeas,
  ideaTitleFromUpload,
  validateBancoDirectUpload,
  type AttachableBankIdea,
  type BancoUploadKind,
  type BancoUploadMode,
} from '@/lib/pipeline/banco-direct-upload'
import { cn } from '@/lib/utils'

const SELECT =
  'h-11 w-full min-w-0 rounded-lg border border-border bg-background px-3 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 md:text-sm'

export interface BancoUploadClient {
  id: string
  name: string
}

export function BancoUploadDialog({
  clients,
  ideas,
  triggerClassName,
  triggerLabel = 'Subir videos',
  defaultClientId = '',
  defaultKind = 'raw',
}: {
  clients: BancoUploadClient[]
  ideas: AttachableBankIdea[]
  triggerClassName?: string
  triggerLabel?: string
  defaultClientId?: string
  defaultKind?: BancoUploadKind
}) {
  const router = useRouter()
  const { toast } = useToast()
  const formId = useId()
  const startUpload = useUploadStore((s) => s.startUpload)
  const [open, setOpen] = useState(false)
  const [clientId, setClientId] = useState(defaultClientId)
  const [mode, setMode] = useState<BancoUploadMode>('new')
  const [ideaId, setIdeaId] = useState('')
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<BancoUploadKind>(defaultKind)
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const attachable = useMemo(() => attachableBankIdeas(ideas, clientId), [ideas, clientId])
  const canSubmit = !!clientId && files.length > 0 && (kind === 'broll' || mode === 'new' || !!ideaId) && !pending

  function reset() {
    setMode('new')
    setIdeaId('')
    setTitle('')
    setKind(defaultKind)
    setClientId(defaultClientId)
    setFiles([])
    setError(null)
    setPending(false)
  }

  async function submit() {
    const chosen = attachable.find((i) => i.id === ideaId)
    const ideaTitle = mode === 'new' ? ideaTitleFromUpload(title, files) : (chosen?.title ?? '')
    const problem = validateBancoDirectUpload({
      clientId,
      mode,
      ideaId: ideaId || null,
      title: ideaTitle,
      kind,
      files,
    })
    if (problem) {
      setError(problem)
      return
    }

    setPending(true)
    setError(null)
    let targetIdeaId = ideaId
    let uploadTitle = ideaTitle
    if (kind === 'broll') {
      const clientName = clients.find((c) => c.id === clientId)?.name ?? 'cliente'
      const res = await ensureClientBrollLibrary({ clientId, clientName })
      if (res.error || !res.ideaId) {
        setPending(false)
        toast({ title: 'No se pudo abrir el B-roll del cliente', description: res.error, variant: 'destructive' })
        return
      }
      targetIdeaId = res.ideaId
      uploadTitle = ideaTitleFromUpload(title, files) || 'B-roll'
    } else if (mode === 'new') {
      const res = await createBankIdea({ clientId, title: ideaTitle })
      if (res.error || !res.ideaId) {
        setPending(false)
        toast({ title: 'No se pudo crear la idea', description: res.error, variant: 'destructive' })
        return
      }
      targetIdeaId = res.ideaId
      uploadTitle = ideaTitle
    }

    for (const file of files) {
      startUpload({ file, ideaId: targetIdeaId, kind, provider: 'r2', title: uploadTitle })
    }
    toast({
      title: files.length === 1 ? 'Subiendo video' : `Subiendo ${files.length} videos`,
      description: 'Sigue en la esquina. Puedes salir de esta pantalla.',
    })
    setOpen(false)
    reset()
    router.refresh()
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground',
          triggerClassName,
        )}
      >
        <Upload className="h-3.5 w-3.5" />
        {triggerLabel}
      </button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) reset()
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Subir al banco</DialogTitle>
            <DialogDescription>
              El video entra al banco del cliente. No hace falta una grabación agendada.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Cliente</span>
              <select
                aria-label="Cliente"
                value={clientId}
                onChange={(e) => {
                  setClientId(e.target.value)
                  setIdeaId('')
                }}
                className={SELECT}
              >
                <option value="">Elige un cliente</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>

            {kind !== 'broll' && (
              <fieldset className="space-y-2">
                <legend className="text-xs font-medium text-muted-foreground">Destino</legend>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm">
                    <input type="radio" name={`${formId}-mode`} checked={mode === 'new'} onChange={() => setMode('new')} />
                    Idea nueva
                  </label>
                  <label className="flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm">
                    <input type="radio" name={`${formId}-mode`} checked={mode === 'existing'} onChange={() => setMode('existing')} />
                    Idea existente
                  </label>
                </div>
              </fieldset>
            )}

            {kind === 'broll' ? (
              <p className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                Este B-roll queda en la librería del cliente. No se va cuando se publica un video.
              </p>
            ) : mode === 'new' ? (
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">Título</span>
                <Input
                  aria-label="Título"
                  placeholder="Si lo dejas vacío, usa el nombre del archivo"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
            ) : (
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">Idea</span>
                <select
                  aria-label="Idea"
                  value={ideaId}
                  onChange={(e) => setIdeaId(e.target.value)}
                  className={SELECT}
                  disabled={!clientId}
                >
                  <option value="">{clientId ? 'Elige una idea' : 'Elige un cliente primero'}</option>
                  {attachable.map((idea) => (
                    <option key={idea.id} value={idea.id}>{idea.title}</option>
                  ))}
                </select>
                {clientId && attachable.length === 0 && (
                  <p className="text-xs text-muted-foreground">Este cliente no tiene ideas abiertas. Crea una nueva.</p>
                )}
              </label>
            )}

            <fieldset className="space-y-2">
              <legend className="text-xs font-medium text-muted-foreground">Tipo</legend>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm">
                  <input type="radio" name={`${formId}-kind`} checked={kind === 'raw'} onChange={() => setKind('raw')} />
                  Crudo
                </label>
                <label className="flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm">
                  <input type="radio" name={`${formId}-kind`} checked={kind === 'broll'} onChange={() => setKind('broll')} />
                  B-roll
                </label>
              </div>
            </fieldset>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Videos</span>
              <input
                type="file"
                accept="video/*"
                multiple
                aria-label="Videos"
                className="block w-full text-sm text-muted-foreground file:mr-3 file:min-h-11 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:text-xs file:font-semibold file:text-primary-foreground"
                onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              />
              {files.length > 0 && (
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {files.map((f) => (
                    <li key={f.name} className="truncate">{f.name}</li>
                  ))}
                </ul>
              )}
            </label>

            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="button" disabled={!canSubmit} onClick={() => void submit()}>
              {pending ? 'Subiendo…' : 'Subir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
