'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, PauseCircle, PlayCircle } from 'lucide-react'
import { pauseClient, activateClient } from '@/lib/actions/clients'
import { useHasPermission } from '@/components/auth/role-gate'
import { useToast } from '@/lib/hooks/use-toast'
import type { ClientStatus } from '@/lib/supabase/types'

export function ClientPauseButton({ clientId, clientName, status }: {
  clientId: string; clientName: string; status: ClientStatus
}) {
  const allowed = useHasPermission('clients.edit')
  const [current, setCurrent] = useState(status)
  const [, startTransition] = useTransition()
  const [pending, setPending] = useState(false)
  const router = useRouter()
  const { toast } = useToast()
  useEffect(() => { setCurrent(status) }, [status])
  if (!allowed) return null
  const paused = current === 'paused'
  function toggle() {
    const previous = current
    const next = paused ? 'active' : 'paused'
    setCurrent(next)
    setPending(true)
    startTransition(async () => {
      try {
        const result = next === 'paused' ? await pauseClient(clientId) : await activateClient(clientId)
        if (result.error) throw new Error(result.error)
        toast({
          title: next === 'paused' ? 'Cliente pausado' : 'Cliente reactivado',
          description: next === 'paused'
            ? `${clientName} queda inactivo y conserva su historial.`
            : `${clientName} vuelve a estar activo.`,
        })
        router.refresh()
      } catch (error) {
        setCurrent(previous)
        toast({ title: 'No se pudo cambiar el estado', description: error instanceof Error ? error.message : 'Intenta nuevamente.', variant: 'destructive' })
      } finally { setPending(false) }
    })
  }
  return <button
    type="button"
    disabled={pending}
    onClick={toggle}
    className={`inline-flex min-h-10 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg border px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-60 ${paused ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-400' : 'border-amber-500/50 bg-amber-500/15 text-amber-800 hover:bg-amber-500/25 dark:text-amber-300'}`}
  >
    {pending ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : paused ? <PlayCircle aria-hidden="true" className="h-4 w-4" /> : <PauseCircle aria-hidden="true" className="h-4 w-4" />}
    {pending ? 'Guardando…' : paused ? 'Reactivar cliente' : 'Pausar cliente'}
  </button>
}
