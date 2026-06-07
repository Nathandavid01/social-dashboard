'use client'

import { useState, useTransition } from 'react'
import { Send, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useHasPermission } from '@/components/auth/role-gate'
import { useToast } from '@/lib/hooks/use-toast'
import { publishIdeaToMetricool } from '@/lib/actions/idea-posting'

/**
 * Manual "Publicar a Metricool" for an APPROVED idea. The server action
 * re-verifies readiness (caption + edited video + not already posted) and
 * idempotency, so this button can just try and surface the result.
 *
 * Shows an "En Metricool" badge once posted. Hidden for users without
 * `posting.publish` (owner / supervisor).
 */
export function PublishToMetricoolButton({
  ideaId,
  metricoolPostId,
}: {
  ideaId: string
  metricoolPostId?: number | null
}) {
  const canPublish = useHasPermission('posting.publish')
  const { toast } = useToast()
  const [pending, start] = useTransition()
  const [posted, setPosted] = useState(metricoolPostId != null)

  if (posted) {
    return (
      <Badge
        variant="outline"
        className="gap-1 border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/50 dark:bg-sky-900/30 dark:text-sky-300"
      >
        <CheckCircle2 className="h-3.5 w-3.5" /> En Metricool
      </Badge>
    )
  }

  if (!canPublish) return null

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await publishIdeaToMetricool(ideaId)
          if (res?.error) {
            toast({ title: 'No se pudo publicar', description: res.error, variant: 'destructive' })
          } else if (res?.skipped) {
            toast({ title: 'Aún no está listo', description: res.skipped })
          } else {
            setPosted(true)
            toast({ title: 'Programado en Metricool', description: 'El video se publicará en su fecha planificada.' })
          }
        })
      }
    >
      <Send className="h-4 w-4" /> Publicar a Metricool
    </Button>
  )
}
