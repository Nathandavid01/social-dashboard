import { Lightbulb, Clock, Workflow, CheckCircle2, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  total: number
  pendientes: number
  enFlujo: number
  publicadas: number
}

interface ChipDef {
  value: number
  label: string
  icon: LucideIcon
  tone: string   // text + icon color
  ring: string   // subtle bg/border
}

/** Compact, colorful stat chips for the Workflow toolbar. */
export function WorkflowStats({ total, pendientes, enFlujo, publicadas }: Props) {
  const chips: ChipDef[] = [
    { value: total, label: 'Ideas', icon: Lightbulb, tone: 'text-primary', ring: 'bg-primary/10 border-primary/20' },
    { value: pendientes, label: 'Pendientes', icon: Clock, tone: 'text-amber-600', ring: 'bg-amber-500/10 border-amber-500/20' },
    { value: enFlujo, label: 'En flujo', icon: Workflow, tone: 'text-blue-600', ring: 'bg-blue-500/10 border-blue-500/20' },
    { value: publicadas, label: 'Publicadas', icon: CheckCircle2, tone: 'text-green-600', ring: 'bg-green-500/10 border-green-500/20' },
  ]

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((c) => {
        const Icon = c.icon
        return (
          <div
            key={c.label}
            className={cn('flex items-center gap-2 rounded-xl border px-3 py-1.5 transition-colors', c.ring)}
          >
            <Icon className={cn('h-4 w-4 shrink-0', c.tone)} />
            <span className={cn('text-base font-bold leading-none tabular-nums', c.tone)}>{c.value}</span>
            <span className="text-[11px] font-medium leading-none text-muted-foreground">{c.label}</span>
          </div>
        )
      })}
    </div>
  )
}
