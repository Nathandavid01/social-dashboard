'use client'

import { useState, useTransition } from 'react'
import { Save, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/lib/hooks/use-toast'
import { updateWorkflowSettings } from '@/lib/actions/workflow-settings'
import { BATCH_STAGES } from '@/lib/utils/content-batches'
import type { PipelineStepAssignees } from '@/lib/utils/pipeline-step-assignees'
import type { BatchStageKey } from '@/lib/utils/content-batches'

interface Member {
  id: string
  full_name: string | null
}

interface Props {
  initial: PipelineStepAssignees
  members: Member[]
}

export function PipelineStepAssigneesForm({ initial, members }: Props) {
  const [assignees, setAssignees] = useState<PipelineStepAssignees>({ ...initial })
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  function setStage(stage: BatchStageKey, userId: string | null) {
    setAssignees((prev) => {
      const next = { ...prev }
      if (!userId || userId === 'unassigned') delete next[stage]
      else next[stage] = userId
      return next
    })
  }

  function save() {
    startTransition(async () => {
      const res = await updateWorkflowSettings({ pipeline_step_assignees: assignees })
      if (res.error) toast({ title: 'Error', description: res.error, variant: 'destructive' })
      else toast({ title: 'Responsables del pipeline guardados' })
    })
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Responsables del pipeline (paso a paso)</CardTitle>
        <p className="text-xs text-muted-foreground">
          Quién hace cada etapa del tablero: Idea → Título → Caption → Video → Edición → Aprobación → Publicación.
          Las tarjetas planificadas muestran al responsable del paso actual.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          {BATCH_STAGES.map((stage) => (
            <div key={stage.key} className="space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/80">
                {stage.label}
              </span>
              <Select
                value={assignees[stage.key] ?? 'unassigned'}
                onValueChange={(v) => setStage(stage.key, v)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Sin asignar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Sin asignar</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.full_name ?? 'Sin nombre'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
        <div className="flex justify-end pt-1">
          <Button onClick={save} disabled={isPending} size="sm">
            {isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-2 h-3.5 w-3.5" />}
            Guardar responsables
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
