'use client'

import { useState, useTransition } from 'react'
import { Send, CheckCircle2, RotateCcw, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription, DialogTrigger,
} from '@/components/ui/dialog'
import { ClientLogo } from '@/components/clients/client-logo'
import { useHasPermission } from '@/components/auth/role-gate'
import { useToast } from '@/lib/hooks/use-toast'
import {
  submitIdeaForApproval,
  approveIdea,
  requestRevision,
} from '@/lib/actions/idea-approval'
import type { IdeaApprovalStatus } from '@/lib/supabase/types'

interface Props {
  ideaId: string
  approvalStatus: IdeaApprovalStatus
  /** Client identity shown in the approve-confirmation dialog (anti-wrong-client). */
  clientName?: string | null
  clientLogoUrl?: string | null
  ideaTitle?: string | null
}

/**
 * Renders the approval action(s) appropriate for the current user's role and
 * the idea's approval_status (design spec §4):
 *
 *   pending          -> "Enviar a revisión"
 *   submitted        -> "Aprobar" + "Pedir cambios"
 *   revision_needed  -> "Reenviar a revisión"
 *   approved         -> terminal; no actions, shows approved state
 *
 * Only owner / video.approve roles can act; everyone else gets a disabled
 * explanatory state.
 */
export function ApprovalButton({ ideaId, approvalStatus, clientName, clientLogoUrl, ideaTitle }: Props) {
  const canApprove = useHasPermission('video.approve')
  const { toast } = useToast()
  const [pending, startTransition] = useTransition()
  const [confirmOpen, setConfirmOpen] = useState(false)

  function run(action: () => Promise<{ ok?: true; error?: string }>) {
    startTransition(async () => {
      const res = await action()
      if (res?.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' })
      } else {
        toast({ title: 'Listo', description: 'Estado de aprobación actualizado.' })
      }
    })
  }

  // Approved is terminal regardless of role.
  if (approvalStatus === 'approved') {
    return (
      <Badge
        variant="outline"
        className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-900/30 dark:text-emerald-300"
      >
        <CheckCircle2 className="h-3.5 w-3.5" /> Aprobado
      </Badge>
    )
  }

  // No permission → explanatory disabled state.
  if (!canApprove) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] italic text-muted-foreground/70">
        <Lock className="h-3 w-3" /> Sin permiso para aprobar
      </span>
    )
  }

  if (approvalStatus === 'submitted') {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {/* Approve requires a deliberate confirm that surfaces the client — so a
            video is never green-lit for the wrong client. */}
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogTrigger asChild>
            <Button type="button" size="sm" disabled={pending}>
              <CheckCircle2 className="h-4 w-4" /> Aprobar
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Confirmar aprobación</DialogTitle>
              <DialogDescription>Verifica que el video sea del cliente correcto antes de aprobar.</DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <ClientLogo name={clientName} logoUrl={clientLogoUrl} className="h-10 w-10" />
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Cliente</p>
                <p className="truncate font-semibold">{clientName || 'Cliente'}</p>
                {ideaTitle && <p className="truncate text-sm text-muted-foreground">{ideaTitle}</p>}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" disabled={pending} onClick={() => setConfirmOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={pending}
                onClick={() => { setConfirmOpen(false); run(() => approveIdea(ideaId)) }}
              >
                <CheckCircle2 className="h-4 w-4" /> Sí, aprobar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => run(() => requestRevision(ideaId))}
        >
          <RotateCcw className="h-4 w-4" /> Pedir revisión
        </Button>
      </div>
    )
  }

  // pending | revision_needed → submit / resubmit
  const label = approvalStatus === 'revision_needed' ? 'Reenviar a revisión' : 'Enviar a revisión'
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() => run(() => submitIdeaForApproval(ideaId))}
    >
      <Send className="h-4 w-4" /> {label}
    </Button>
  )
}
