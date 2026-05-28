'use client'

import { useState, useTransition } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Save, Loader2, RotateCcw, Power, PowerOff } from 'lucide-react'
import { useToast } from '@/lib/hooks/use-toast'
import { updateWorkflowSettings, type WorkflowSettingsPatch } from '@/lib/actions/workflow-settings'
import { cn } from '@/lib/utils'
import type { WorkflowSettings } from '@/lib/utils/workflow-types'

interface Props {
  initial: WorkflowSettings
}

const DEFAULTS = {
  weekly_planning_enabled: true,
  scheduling_window_days: 7,
  min_ideas_per_session: 4,
  ideas_multiplier: 2,
  require_rescheduling: true,
}

export function WorkflowSettingsForm({ initial }: Props) {
  const [form, setForm] = useState({
    weekly_planning_enabled: initial.weekly_planning_enabled,
    scheduling_window_days: initial.scheduling_window_days,
    min_ideas_per_session: initial.min_ideas_per_session,
    ideas_multiplier: initial.ideas_multiplier,
    require_rescheduling: initial.require_rescheduling,
  })
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  function save() {
    startTransition(async () => {
      const patch: WorkflowSettingsPatch = { ...form }
      const res = await updateWorkflowSettings(patch)
      if (res.error) toast({ title: 'Error', description: res.error, variant: 'destructive' })
      else toast({ title: 'Configuración guardada' })
    })
  }

  function resetDefaults() {
    setForm(DEFAULTS)
    toast({ title: 'Valores por defecto cargados', description: 'Pulsa Guardar para aplicar' })
  }

  return (
    <div className="space-y-5">
      {/* Master switch */}
      <Card className={cn(
        'border-2 transition-colors',
        form.weekly_planning_enabled
          ? 'border-green-500/40 bg-green-500/[0.04]'
          : 'border-muted bg-muted/30',
      )}>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              'grid h-10 w-10 place-items-center rounded-lg',
              form.weekly_planning_enabled ? 'bg-green-500/15 text-green-500' : 'bg-muted text-muted-foreground',
            )}>
              {form.weekly_planning_enabled ? <Power className="h-4 w-4" /> : <PowerOff className="h-4 w-4" />}
            </div>
            <div>
              <p className="font-semibold">Workflow de planning semanal</p>
              <p className="text-xs text-muted-foreground">
                {form.weekly_planning_enabled
                  ? 'Activo — banner, badge y página /planning están visibles para el equipo.'
                  : 'Desactivado — la UI de planning queda oculta hasta reactivar.'}
              </p>
            </div>
          </div>
          <Button
            variant={form.weekly_planning_enabled ? 'outline' : 'default'}
            size="sm"
            onClick={() => setForm({ ...form, weekly_planning_enabled: !form.weekly_planning_enabled })}
          >
            {form.weekly_planning_enabled ? 'Desactivar' : 'Activar'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Umbrales</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="scheduling_window_days" className="text-xs">
                Ventana de agendamiento (días)
              </Label>
              <Input
                id="scheduling_window_days"
                type="number"
                min={1}
                max={60}
                value={form.scheduling_window_days}
                onChange={(e) => setForm({ ...form, scheduling_window_days: Number(e.target.value) })}
                className="h-9"
              />
              <p className="text-[10px] text-muted-foreground">
                Cuántos días hacia adelante consideras "ya agendado".
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="min_ideas_per_session" className="text-xs">
                Ideas mínimas por sesión
              </Label>
              <Input
                id="min_ideas_per_session"
                type="number"
                min={0}
                max={50}
                value={form.min_ideas_per_session}
                onChange={(e) => setForm({ ...form, min_ideas_per_session: Number(e.target.value) })}
                className="h-9"
              />
              <p className="text-[10px] text-muted-foreground">
                Piso de ideas requeridas para considerar un cliente "listo".
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ideas_multiplier" className="text-xs">
                Multiplicador de ideas (posting_days × N)
              </Label>
              <Input
                id="ideas_multiplier"
                type="number"
                step={0.5}
                min={0}
                max={10}
                value={form.ideas_multiplier}
                onChange={(e) => setForm({ ...form, ideas_multiplier: Number(e.target.value) })}
                className="h-9"
              />
              <p className="text-[10px] text-muted-foreground">
                Target = max(piso, días posteo × multiplicador). Sirve para tener buffer.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Reglas</CardTitle>
        </CardHeader>
        <CardContent>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/40">
            <input
              type="checkbox"
              checked={form.require_rescheduling}
              onChange={(e) => setForm({ ...form, require_rescheduling: e.target.checked })}
              className="mt-1 h-4 w-4 accent-primary"
            />
            <div className="min-w-0">
              <p className="text-sm font-medium">Exigir reagendar después de cada sesión</p>
              <p className="text-xs text-muted-foreground">
                Si el cliente tuvo una sesión que ya pasó y no hay una próxima agendada,
                aparece en estado <strong>Reagendar</strong> hasta que se cree la nueva.
              </p>
            </div>
          </label>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={resetDefaults} disabled={isPending}>
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Restaurar default
        </Button>
        <Button onClick={save} disabled={isPending}>
          {isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-2 h-3.5 w-3.5" />}
          Guardar configuración
        </Button>
      </div>
    </div>
  )
}
