'use client'

import { useState } from 'react'
import type { Alert } from '@/lib/supabase/types'
import { AlertItem } from './alert-item'
import { EmptyState } from '@/components/shared/empty-state'
import { BellOff } from 'lucide-react'

interface AlertsPanelProps {
  initialAlerts: Alert[]
}

export function AlertsPanel({ initialAlerts }: AlertsPanelProps) {
  const [alerts, setAlerts] = useState<Alert[]>(initialAlerts)

  function handleDismiss(id: string) {
    setAlerts((prev) => prev.filter((a) => a.id !== id))
  }

  const critical = alerts.filter((a) => a.severity === 'error')
  const warnings = alerts.filter((a) => a.severity === 'warning')
  const others = alerts.filter((a) => a.severity !== 'error' && a.severity !== 'warning')

  if (alerts.length === 0) {
    return (
      <EmptyState
        icon={BellOff}
        title="All clear"
        description="No active alerts. Everything looks good."
      />
    )
  }

  return (
    <div className="space-y-6">
      {critical.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-red-500 flex items-center gap-2">
            Critical
            <span className="bg-red-500/10 text-red-500 text-xs px-1.5 py-0.5 rounded-full">
              {critical.length}
            </span>
          </h2>
          {critical.map((alert) => (
            <AlertItem key={alert.id} alert={alert} onDismiss={handleDismiss} />
          ))}
        </section>
      )}

      {warnings.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-yellow-500 flex items-center gap-2">
            Warnings
            <span className="bg-yellow-500/10 text-yellow-500 text-xs px-1.5 py-0.5 rounded-full">
              {warnings.length}
            </span>
          </h2>
          {warnings.map((alert) => (
            <AlertItem key={alert.id} alert={alert} onDismiss={handleDismiss} />
          ))}
        </section>
      )}

      {others.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">Other</h2>
          {others.map((alert) => (
            <AlertItem key={alert.id} alert={alert} onDismiss={handleDismiss} />
          ))}
        </section>
      )}
    </div>
  )
}
