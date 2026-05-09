'use client'

import { useTransition } from 'react'
import { dismissAlert } from '@/lib/actions/alerts'
import type { Alert } from '@/lib/supabase/types'
import { cn, alertSeverityColors, alertSeverityTextColors, formatRelative } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { X, Info, AlertTriangle, AlertCircle, CheckCircle2 } from 'lucide-react'

const severityIcons = {
  info: Info,
  warning: AlertTriangle,
  error: AlertCircle,
  success: CheckCircle2,
}

const severityLabels = {
  info: 'Info',
  warning: 'Warning',
  error: 'Critical',
  success: 'Resolved',
}

interface AlertItemProps {
  alert: Alert
  onDismiss?: (id: string) => void
}

export function AlertItem({ alert, onDismiss }: AlertItemProps) {
  const [isPending, startTransition] = useTransition()
  const Icon = severityIcons[alert.severity]

  function handleDismiss() {
    onDismiss?.(alert.id)
    startTransition(async () => {
      await dismissAlert(alert.id)
    })
  }

  return (
    <div
      className={cn(
        'flex gap-3 p-4 rounded-lg border-l-4 border border-border/50',
        alertSeverityColors[alert.severity],
        isPending && 'opacity-50'
      )}
    >
      <Icon className={cn('h-4 w-4 mt-0.5 shrink-0', alertSeverityTextColors[alert.severity])} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className={cn('text-xs font-semibold uppercase tracking-wide', alertSeverityTextColors[alert.severity])}>
              {severityLabels[alert.severity]}
            </span>
            <span className="text-xs text-muted-foreground">{formatRelative(alert.created_at)}</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={handleDismiss}
            disabled={isPending}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
        <p className="font-medium text-sm mt-0.5">{alert.title}</p>
        {alert.message && (
          <p className="text-xs text-muted-foreground mt-1">{alert.message}</p>
        )}
      </div>
    </div>
  )
}
