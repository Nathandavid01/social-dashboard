'use client'

import { useState } from 'react'
import { Users, Plus } from 'lucide-react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

export interface AddClientsToPipelineProps {
  clients: { id: string; name: string }[]
  onAdd: (clientIds: string[]) => Promise<{ created?: number; error?: string }>
  onDone: () => void
  onError?: (message: string) => void
}

/**
 * Bulk-add clients to the Content Pipeline board. Each selected client gets a
 * starter card in the Idea column (via addClientsToPipeline). Use when you
 * decide which clients you're working this period.
 */
export function AddClientsToPipeline({ clients, onAdd, onDone, onError }: AddClientsToPipelineProps) {
  const [open, setOpen] = useState(false)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [pending, setPending] = useState(false)

  function toggle(id: string) {
    setSel((s) => {
      const next = new Set(s)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function submit() {
    if (sel.size === 0 || pending) return
    setPending(true)
    const res = await onAdd(Array.from(sel))
    setPending(false)
    if (res.error) { onError?.(res.error); return }
    setOpen(false)
    setSel(new Set())
    onDone()
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.02] px-2.5 text-xs text-muted-foreground transition hover:bg-white/[0.05] hover:text-foreground"
      >
        <Users className="h-3.5 w-3.5" /> Agregar clientes
      </button>
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSel(new Set()) }}>
        <DialogContent className="dark max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Agregar clientes al pipeline</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">Cada cliente seleccionado entra con un lote nuevo en la columna Idea.</p>
          <div className="max-h-[50vh] space-y-1 overflow-y-auto py-2">
            {clients.map((c) => (
              <label
                key={c.id}
                htmlFor={`cl-${c.id}`}
                className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-sm hover:bg-white/[0.04]"
              >
                <input
                  id={`cl-${c.id}`}
                  type="checkbox"
                  checked={sel.has(c.id)}
                  onChange={() => toggle(c.id)}
                  className="h-4 w-4 accent-primary"
                />
                {c.name}
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={submit} disabled={sel.size === 0 || pending}>
              <Plus className="mr-1 h-4 w-4" /> {pending ? 'Agregando…' : `Agregar al pipeline (${sel.size})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
