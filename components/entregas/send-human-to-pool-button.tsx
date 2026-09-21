'use client'

import { useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { RoleGate } from '@/components/auth/role-gate'
import { useToast } from '@/lib/hooks/use-toast'
import { sendHumanReciboToPool } from '@/lib/actions/recibo'
import {
  canSendHumanReciboToPool,
  humanPoolGate,
  humanPoolGateMessage,
  type PoolStateInput,
} from '@/lib/utils/client-pool-state'
import { cn } from '@/lib/utils'

export function SendHumanToPoolButton({ input, ideaId }: { input: PoolStateInput; ideaId: string }) {
  const { toast } = useToast()
  const [sent, setSent] = useState(false)
  const [isPending, start] = useTransition()
  const gateInput = { ...input, staff_pool_ready: sent || input.staff_pool_ready }
  const reason = humanPoolGate(gateInput)
  const canSend = canSendHumanReciboToPool(gateInput)

  if (reason === 'ai_auto' || reason === 'not_human') return null

  return (
    <RoleGate perm="pool.send_human">
      {canSend ? (
        <button
          type="button"
          disabled={isPending}
          onClick={(e) => {
            e.stopPropagation()
            setSent(true)
            start(async () => {
              const res = await sendHumanReciboToPool({ ideaId })
              if (res.error) {
                setSent(false)
                toast({ title: 'No se pudo enviar al pool', description: res.error, variant: 'destructive' })
              } else {
                toast({ title: 'Listo en el pool' })
              }
            })
          }}
          className={cn(
            'flex min-h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-[11px] font-semibold text-amber-700 touch-manipulation dark:text-amber-200',
            isPending && 'opacity-50',
          )}
        >
          {isPending ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : null}
          Enviar al pool · Listo
        </button>
      ) : reason === 'already_listo' ? (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-2 py-1.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
          Listo en el pool
        </p>
      ) : reason === 'falta_revision' ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-2 py-1.5 text-[10px] font-medium text-amber-700 dark:text-amber-200">
          {humanPoolGateMessage(reason)}
        </p>
      ) : null}
    </RoleGate>
  )
}
