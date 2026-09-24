'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { useHasPermission } from '@/components/auth/role-gate'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useToast } from '@/lib/hooks/use-toast'
import { discardEntregaVideos } from '@/lib/actions/pipeline-submit'

/** Removes one AI upload from Recibo after an explicit confirmation. */
export function ReciboDeleteButton({ ideaId, title }: { ideaId: string; title: string }) {
  const canDiscard = useHasPermission('video.discard')
  const router = useRouter()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  if (!canDiscard) return null

  async function confirm() {
    setLoading(true)
    try {
      const res = await discardEntregaVideos([ideaId])
      if (!res?.ok) {
        toast({
          title: 'No se pudo borrar',
          description: res?.error ?? 'Actualiza Recibo e inténtalo de nuevo.',
          variant: 'destructive',
        })
        return
      }
      setOpen(false)
      toast({ title: 'Video borrado de Recibo' })
      router.refresh()
    } catch {
      toast({ title: 'No se pudo borrar', description: 'Actualiza Recibo e inténtalo de nuevo.', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label={`Borrar ${title}`}
        onClick={() => setOpen(true)}
        className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/70 text-white hover:bg-black"
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="¿Borrar este video?"
        description="Se quita de Recibo y no se programa en Metricool."
        confirmLabel="Borrar"
        destructive
        loading={loading}
        onConfirm={() => void confirm()}
      />
    </>
  )
}
