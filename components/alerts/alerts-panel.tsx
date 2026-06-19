'use client'

import { useState, useTransition } from 'react'
import type { Alert } from '@/lib/supabase/types'
import { createAlert } from '@/lib/actions/alerts'
import { AlertItem } from './alert-item'
import { EmptyState } from '@/components/shared/empty-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/lib/hooks/use-toast'
import { BellOff, Plus } from 'lucide-react'
import { friendlyError } from '@/lib/utils/error-message'

interface AlertsPanelProps {
  initialAlerts: Alert[]
}

export function AlertsPanel({ initialAlerts }: AlertsPanelProps) {
  const [alerts, setAlerts] = useState<Alert[]>(initialAlerts)
  const [showCreate, setShowCreate] = useState(false)
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [severity, setSeverity] = useState<'info' | 'warning' | 'error' | 'success'>('info')
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  function handleDismiss(id: string) {
    setAlerts((prev) => prev.filter((a) => a.id !== id))
  }

  function handleCreate() {
    if (!title.trim()) return
    startTransition(async () => {
      const result = await createAlert({ title: title.trim(), message: message.trim() || undefined, severity })
      if (result.error) {
        toast({ title: 'Error', description: friendlyError(result.error), variant: 'destructive' })
        return
      }
      toast({ title: 'Alerta creada', description: 'Visible para todo el equipo' })
      setTitle('')
      setMessage('')
      setSeverity('info')
      setShowCreate(false)
      // Refresh page to show new alert
      window.location.reload()
    })
  }

  const critical = alerts.filter((a) => a.severity === 'error')
  const warnings = alerts.filter((a) => a.severity === 'warning')
  const others = alerts.filter((a) => a.severity !== 'error' && a.severity !== 'warning')

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="mr-2 h-3.5 w-3.5" />
          Nueva Alerta
        </Button>
      </div>

      {alerts.length === 0 ? (
        <EmptyState
          icon={BellOff}
          title="All clear"
          description="No active alerts. Everything looks good."
        />
      ) : (
        <>
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
        </>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva Alerta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Título</label>
              <Input
                placeholder="ej. Reunión de equipo mañana 9am"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Mensaje (opcional)</label>
              <Textarea
                placeholder="Más detalles..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="resize-none h-20"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Severidad</label>
              <Select value={severity} onValueChange={(v) => setSeverity(v as typeof severity)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">Info — General info</SelectItem>
                  <SelectItem value="warning">Warning — Requires attention</SelectItem>
                  <SelectItem value="error">Critical — Urgent</SelectItem>
                  <SelectItem value="success">Success — Good news</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
              <Button onClick={handleCreate} disabled={!title.trim() || isPending}>
                {isPending ? 'Creando...' : 'Crear Alerta'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
