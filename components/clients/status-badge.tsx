import { Badge } from '@/components/ui/badge'
import { cn, statusColors } from '@/lib/utils'
import type { ClientStatus } from '@/lib/supabase/types'

const statusLabels: Record<ClientStatus, string> = {
  active: 'Active',
  paused: 'Paused',
  onboarding: 'Onboarding',
}

export function StatusBadge({ status }: { status: ClientStatus }) {
  return (
    <Badge variant="outline" className={cn('capitalize', statusColors[status])}>
      {statusLabels[status]}
    </Badge>
  )
}
