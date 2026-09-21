'use client'

import { useTransition } from 'react'
import { RoleGate, useEffectiveUserId, useHasPermission } from '@/components/auth/role-gate'
import { useToast } from '@/lib/hooks/use-toast'
import { claimPipelineEdit, releasePipelineEdit } from '@/lib/actions/pipeline-claim'
import {
  decideEditingClaim,
  editingClaimConflictMessage,
  editingClaimLabel,
  formatEditingClaimWhen,
  isEditingClaimed,
  type EditingClaim,
} from '@/lib/pipeline/editing-claim'

export function EditingClaimControls({
  ideaId,
  claim,
  onOptimistic,
}: {
  ideaId: string
  claim: EditingClaim | null | undefined
  onOptimistic?: (next: EditingClaim | null) => void
}) {
  const userId = useEffectiveUserId()
  const canClaim = useHasPermission('pipeline.claim')
  const canForce = useHasPermission('planning.assign')
  const { toast } = useToast()
  const [pending, startTransition] = useTransition()
  const taken = isEditingClaimed(claim)
  const mine = taken && claim?.byId === userId
  const label = editingClaimLabel(claim, userId)
  const when = formatEditingClaimWhen(claim?.at)
  const startDecision = decideEditingClaim(claim, userId)
  const startBlocked = startDecision.ok === false && startDecision.reason === 'taken'

  function start() {
    if (!canClaim || !userId) return
    if (startBlocked) {
      toast({ title: editingClaimConflictMessage(claim), variant: 'destructive' })
      return
    }
    const previous = claim ?? null
    onOptimistic?.({ byId: userId, byName: null, at: new Date().toISOString() })
    startTransition(async () => {
      const result = await claimPipelineEdit(ideaId)
      if ('error' in result && result.error) {
        onOptimistic?.(result.claim ?? previous)
        toast({ title: result.error, variant: 'destructive' })
        return
      }
      if ('ok' in result && result.ok) onOptimistic?.(result.claim)
    })
  }

  function release() {
    if (!canClaim || !userId) return
    const previous = claim ?? null
    onOptimistic?.({ byId: null, byName: null, at: null })
    startTransition(async () => {
      const result = await releasePipelineEdit(ideaId)
      if ('error' in result && result.error) {
        onOptimistic?.(previous)
        toast({ title: result.error, variant: 'destructive' })
      }
    })
  }

  return (
    <div className="mt-1.5 flex min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-1">
      {label ? (
        <span
          data-testid={`editing-claim-${ideaId}`}
          className="min-w-0 truncate rounded bg-sky-500/15 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-sky-300"
          title={when ?? undefined}
        >
          {label}{when ? ` · ${when}` : ''}
        </span>
      ) : (
        <span className="text-[9px] text-slate-500">Libre</span>
      )}
      <RoleGate perm="pipeline.claim">
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          {mine ? (
            <button
              type="button"
              disabled={pending}
              onClick={release}
              className="whitespace-nowrap text-[9px] font-semibold text-slate-400 underline-offset-2 hover:text-white hover:underline disabled:opacity-50"
            >
              Soltar
            </button>
          ) : (
            <button
              type="button"
              disabled={pending || startBlocked}
              onClick={start}
              title={startBlocked ? editingClaimConflictMessage(claim) : 'Reclamar este corte'}
              className="whitespace-nowrap rounded-md border border-[#c8a34a]/40 bg-[#c8a34a]/10 px-1.5 py-0.5 text-[9px] font-semibold text-[#d6b55f] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Empezar edición
            </button>
          )}
          {taken && !mine && canForce && (
            <button
              type="button"
              disabled={pending}
              onClick={release}
              className="whitespace-nowrap text-[9px] font-semibold text-slate-400 underline-offset-2 hover:text-white hover:underline disabled:opacity-50"
            >
              Soltar
            </button>
          )}
        </div>
      </RoleGate>
    </div>
  )
}
