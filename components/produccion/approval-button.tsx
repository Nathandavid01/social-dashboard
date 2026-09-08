'use client'

import Link from 'next/link'
import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useHasPermission } from '@/components/auth/role-gate'
import { useToast } from '@/lib/hooks/use-toast'
import { submitIdeaForApproval } from '@/lib/actions/idea-approval'
import { CorrectionUpload } from '@/components/review/correction-upload'
import type { IdeaApprovalStatus } from '@/lib/supabase/types'

interface Props {
  ideaId: string
  videoFileId?: string | null
  approvalStatus: IdeaApprovalStatus
  clientName?: string | null
  clientLogoUrl?: string | null
  ideaTitle?: string | null
}

export function ApprovalButton({ ideaId, approvalStatus }: Props) {
  const canApprove = useHasPermission('video.approve')
  const canUpload = useHasPermission('video.upload')
  const { toast } = useToast()
  const [pending, startTransition] = useTransition()
  if (approvalStatus === 'approved') return <Badge variant="outline">Aprobado</Badge>
  if (approvalStatus === 'revision_needed' && canUpload) return <CorrectionUpload ideaId={ideaId} />
  if (approvalStatus === 'submitted' && canApprove) return <Button asChild size="sm"><Link href="/revision">Revisar Video Y Subtítulos</Link></Button>
  if (approvalStatus !== 'pending' || !canUpload) return <span className="text-xs text-muted-foreground">Pendiente Del Responsable</span>
  return <Button size="sm" variant="outline" disabled={pending} onClick={() => startTransition(async () => {
    const result = await submitIdeaForApproval(ideaId)
    toast(result.error ? { title: 'No Se Pudo Enviar', description: result.error, variant: 'destructive' } : { title: 'Enviado A Revisión' })
  })}>Enviar A Revisión</Button>
}
