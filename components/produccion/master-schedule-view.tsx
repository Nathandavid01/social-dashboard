'use client'

import { cn } from '@/lib/utils'

// Master production schedule extracted from PDF
// R = Recording (Grabación), P = Production/Editing
// day_of_week: 1=Lun, 2=Mar, 3=Mié, 4=Jue, 5=Vie, 6=Sáb
type DayEntry = { day: number; type: 'R' | 'P' }

interface ClientSchedule {
  name: string
  days: DayEntry[]
}

const MASTER_SCHEDULE: ClientSchedule[] = [
  { name: 'Arasibo Steakhouse', days: [{ day: 2, type: 'R' }, { day: 4, type: 'R' }, { day: 6, type: 'R' }] },
  { name: 'Arte Digital', days: [{ day: 1, type: 'P' }, { day: 2, type: 'R' }, { day: 3, type: 'P' }, { day: 4, type: 'R' }, { day: 5, type: 'P' }, { day: 6, type: 'R' }] },
  { name: 'Auto Ksero', days: [{ day: 1, type: 'R' }, { day: 2, type: 'P' }, { day: 3, type: 'R' }, { day: 4, type: 'P' }, { day: 5, type: 'R' }, { day: 6, type: 'P' }] },
  { name: 'Beyond PVC', days: [{ day: 2, type: 'R' }, { day: 3, type: 'P' }, { day: 5, type: 'R' }] },
  { name: 'Buena Vida', days: [{ day: 1, type: 'R' }, { day: 3, type: 'R' }, { day: 5, type: 'R' }] },
  { name: 'Casita Vieja', days: [{ day: 1, type: 'R' }, { day: 2, type: 'P' }, { day: 3, type: 'R' }, { day: 4, type: 'P' }, { day: 5, type: 'R' }] },
  { name: 'Codepola', days: [{ day: 1, type: 'R' }, { day: 3, type: 'R' }, { day: 5, type: 'R' }] },
  { name: 'Comida', days: [{ day: 2, type: 'P' }, { day: 4, type: 'P' }, { day: 6, type: 'P' }] },
  { name: 'Dorado Del Mar Club', days: [{ day: 2, type: 'R' }, { day: 4, type: 'R' }] },
  { name: "Dorta's Pizza", days: [{ day: 2, type: 'R' }, { day: 5, type: 'R' }, { day: 6, type: 'P' }] },
  { name: 'Dr. Rodríguez', days: [{ day: 1, type: 'R' }, { day: 3, type: 'P' }, { day: 5, type: 'R' }] },
  { name: 'El Capi', days: [{ day: 2, type: 'R' }, { day: 4, type: 'R' }, { day: 6, type: 'R' }] },
  { name: 'El Cuarto Bate', days: [{ day: 1, type: 'R' }, { day: 2, type: 'P' }, { day: 3, type: 'R' }, { day: 4, type: 'P' }, { day: 5, type: 'R' }] },
  { name: 'Go Kart', days: [{ day: 3, type: 'R' }, { day: 5, type: 'R' }] },
  { name: 'La Gira', days: [{ day: 1, type: 'R' }, { day: 3, type: 'R' }, { day: 5, type: 'R' }] },
  { name: 'La Rambla Tapas y Vino', days: [{ day: 3, type: 'R' }, { day: 5, type: 'R' }] },
  { name: 'Long y Cerrajero', days: [{ day: 2, type: 'R' }] },
  { name: 'Lucky Pet', days: [{ day: 1, type: 'R' }, { day: 2, type: 'P' }, { day: 3, type: 'R' }, { day: 4, type: 'P' }, { day: 5, type: 'R' }] },
  { name: 'Lumavi', days: [{ day: 1, type: 'R' }, { day: 2, type: 'R' }, { day: 3, type: 'R' }, { day: 4, type: 'R' }, { day: 5, type: 'R' }] },
  { name: 'Mia Pizzería', days: [{ day: 1, type: 'R' }, { day: 2, type: 'P' }, { day: 3, type: 'R' }, { day: 4, type: 'P' }, { day: 5, type: 'R' }] },
  { name: "Nana's", days: [{ day: 1, type: 'P' }, { day: 3, type: 'R' }, { day: 6, type: 'R' }] },
  { name: 'New York', days: [{ day: 3, type: 'R' }, { day: 6, type: 'R' }] },
  { name: 'Personal Truco', days: [{ day: 1, type: 'R' }, { day: 3, type: 'R' }, { day: 5, type: 'R' }] },
  { name: 'Predator Gaming Center', days: [{ day: 2, type: 'R' }, { day: 5, type: 'R' }] },
  { name: 'Pro y Amilia', days: [{ day: 1, type: 'R' }, { day: 2, type: 'P' }, { day: 3, type: 'R' }, { day: 4, type: 'P' }, { day: 5, type: 'R' }] },
  { name: 'Quantika', days: [{ day: 2, type: 'R' }, { day: 4, type: 'P' }, { day: 6, type: 'R' }] },
  { name: 'Restaurco', days: [{ day: 1, type: 'R' }, { day: 2, type: 'R' }, { day: 4, type: 'R' }, { day: 5, type: 'R' }] },
  { name: 'Rotonda', days: [{ day: 2, type: 'R' }, { day: 3, type: 'P' }, { day: 4, type: 'R' }, { day: 5, type: 'P' }, { day: 6, type: 'R' }] },
  { name: 'Sanguit', days: [{ day: 2, type: 'R' }, { day: 4, type: 'R' }, { day: 6, type: 'P' }] },
  { name: 'Shooters', days: [{ day: 2, type: 'R' }, { day: 4, type: 'R' }] },
  { name: 'Speedy Net', days: [{ day: 1, type: 'R' }, { day: 3, type: 'P' }, { day: 5, type: 'R' }] },
  { name: 'Tierra Nueva', days: [{ day: 4, type: 'R' }] },
  { name: 'Titorios', days: [{ day: 1, type: 'R' }, { day: 3, type: 'R' }, { day: 4, type: 'R' }] },
  { name: 'VID Bonilla Seguros', days: [{ day: 2, type: 'R' }, { day: 3, type: 'P' }, { day: 4, type: 'R' }] },
  { name: 'VSS Properties', days: [{ day: 2, type: 'R' }, { day: 6, type: 'R' }] },
  { name: 'Windmar', days: [{ day: 1, type: 'R' }, { day: 3, type: 'R' }, { day: 5, type: 'R' }] },
]

const DAYS = [
  { num: 1, short: 'Lun', full: 'Lunes' },
  { num: 2, short: 'Mar', full: 'Martes' },
  { num: 3, short: 'Mié', full: 'Miércoles' },
  { num: 4, short: 'Jue', full: 'Jueves' },
  { num: 5, short: 'Vie', full: 'Viernes' },
  { num: 6, short: 'Sáb', full: 'Sábado' },
]

export function MasterScheduleView() {
  // Count entries per day for the footer
  const dailyTotals = DAYS.map(d =>
    MASTER_SCHEDULE.reduce((sum, c) => sum + c.days.filter(e => e.day === d.num).length, 0)
  )

  const totalR = MASTER_SCHEDULE.reduce((sum, c) => sum + c.days.filter(e => e.type === 'R').length, 0)
  const totalP = MASTER_SCHEDULE.reduce((sum, c) => sum + c.days.filter(e => e.type === 'P').length, 0)

  return (
    <div className="space-y-4">
      {/* Legend + summary */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
        <span><span className="font-semibold text-foreground">{MASTER_SCHEDULE.length}</span> clientes</span>
        <span><span className="font-semibold text-foreground">{totalR}</span> sesiones de grabación / semana</span>
        <span><span className="font-semibold text-foreground">{totalP}</span> sesiones de producción / semana</span>
        <div className="flex items-center gap-3 ml-auto">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-7 h-4 rounded-sm bg-yellow-100 border border-yellow-300 text-[9px] font-bold text-yellow-800 flex items-center justify-center leading-none text-center">R</span>
            Grabación
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-7 h-4 rounded-sm bg-zinc-900 border border-zinc-700 text-[9px] font-bold text-yellow-300 flex items-center justify-center leading-none text-center">P</span>
            Producción
          </span>
        </div>
      </div>

      {/* Grid */}
      <div className="rounded-xl border border-border overflow-x-auto">
        {/* Header */}
        <div className="grid grid-cols-[180px_repeat(6,1fr)] bg-muted/50 border-b border-border min-w-[640px]">
          <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Cliente
          </div>
          {DAYS.map(d => (
            <div key={d.num} className="px-2 py-2 text-center border-l border-border">
              <div className="text-xs font-semibold text-muted-foreground">{d.short}</div>
            </div>
          ))}
        </div>

        {/* Client rows */}
        {MASTER_SCHEDULE.map((client, idx) => {
          const dayMap = new Map(client.days.map(e => [e.day, e.type]))
          return (
            <div
              key={client.name}
              className={cn(
                'grid grid-cols-[180px_repeat(6,1fr)] border-b border-border last:border-b-0 min-w-[640px]',
                idx % 2 === 0 ? 'bg-background' : 'bg-muted/10'
              )}
            >
              <div className="px-3 py-2 flex items-center">
                <span className="text-xs font-medium text-foreground truncate">{client.name}</span>
              </div>
              {DAYS.map(d => {
                const type = dayMap.get(d.num)
                return (
                  <div key={d.num} className="border-l border-border px-1.5 py-1.5 flex items-center justify-center min-h-[40px]">
                    {type && (
                      <span className={cn(
                        'rounded-md px-2 py-0.5 text-[11px] font-bold leading-tight',
                        type === 'R'
                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300'
                          : 'bg-zinc-900 text-yellow-300 dark:bg-zinc-700'
                      )}>
                        {type}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* Footer totals */}
      <div className="grid grid-cols-[180px_repeat(6,1fr)] rounded-lg border border-border overflow-hidden text-xs min-w-[640px]">
        <div className="bg-muted/50 px-3 py-2 font-semibold text-muted-foreground">Total diario</div>
        {dailyTotals.map((total, i) => (
          <div key={i} className={cn(
            'border-l border-border px-2 py-2 text-center font-semibold',
            total > 0 ? 'bg-primary/5 text-primary' : 'bg-muted/30 text-muted-foreground'
          )}>
            {total || '—'}
          </div>
        ))}
      </div>

      <p className="text-[11px] text-muted-foreground">
        Horario fijo semanal · <span className="font-medium">R</span> = Grabación · <span className="font-medium">P</span> = Producción/Edición
      </p>
    </div>
  )
}
