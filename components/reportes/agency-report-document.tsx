import { Users, BarChart3, Building2 } from 'lucide-react'
import { formatCompact } from '@/lib/utils/client-report-core'
import type { AgencyReport } from '@/lib/actions/agency-report'

function fmtRange(start: string, end: string): string {
  const p = (s: string) => `${s.slice(6, 8)}/${s.slice(4, 6)}/${s.slice(0, 4)}`
  return `${p(start)} – ${p(end)}`
}

export function AgencyReportDocument({ report }: { report: AgencyReport }) {
  const { rows, totals, metricoolConfigured } = report
  const withData = rows.filter((r) => r.reach > 0 || r.impressions > 0)
  const maxReach = Math.max(1, ...withData.map((r) => r.reach))

  const kpis = [
    { label: 'Alcance total', value: totals.reach, icon: Users },
    { label: 'Impresiones totales', value: totals.impressions, icon: BarChart3 },
    { label: 'Clientes con datos', value: totals.clientsWithData, icon: Building2, raw: true },
  ]

  return (
    <div className="mx-auto max-w-4xl rounded-2xl border bg-white p-8 text-zinc-900 shadow-sm print:border-0 print:shadow-none sm:p-10">
      <header className="flex items-center justify-between gap-4 border-b border-zinc-200 pb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">Resumen de agencia</p>
          <h1 className="text-2xl font-bold tracking-tight">Todas las cuentas</h1>
          <p className="text-sm text-zinc-500">{fmtRange(report.start, report.end)}</p>
        </div>
        <div className="hidden text-right sm:block">
          <p className="text-lg font-extrabold tracking-tight">
            Nate <span className="text-amber-500">Media</span>
          </p>
          <p className="text-xs text-zinc-400">Operaciones de contenido</p>
        </div>
      </header>

      {!metricoolConfigured ? (
        <p className="py-12 text-center text-sm text-zinc-500">Metricool no está configurado, no hay métricas que reportar.</p>
      ) : (
        <>
          <section className="grid grid-cols-3 gap-3 py-6">
            {kpis.map((k) => (
              <div key={k.label} className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="mb-2 flex items-center gap-1.5 text-zinc-400">
                  <k.icon className="h-4 w-4" />
                  <span className="text-[11px] font-medium uppercase tracking-wide">{k.label}</span>
                </div>
                <p className="text-2xl font-extrabold tracking-tight tabular-nums">
                  {k.raw ? k.value : formatCompact(k.value)}
                </p>
              </div>
            ))}
          </section>

          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-zinc-500">
            Clientes por alcance ({withData.length})
          </h2>
          {withData.length === 0 ? (
            <p className="py-10 text-center text-sm text-zinc-500">No hay alcance reportado en este período.</p>
          ) : (
            <ul className="space-y-1.5">
              {withData.map((r, i) => (
                <li key={r.id} className="flex items-center gap-3 rounded-lg border border-zinc-200 px-3 py-2">
                  <span className="w-6 shrink-0 text-center text-sm font-bold text-zinc-400">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold">{r.name}</span>
                      <span className="shrink-0 text-sm font-bold tabular-nums">{formatCompact(r.reach)}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-100">
                      <div
                        className="h-full rounded-full bg-amber-400"
                        style={{ width: `${Math.round((r.reach / maxReach) * 100)}%` }}
                      />
                    </div>
                  </div>
                  <span className="hidden w-20 shrink-0 text-right text-xs text-zinc-400 sm:block">
                    {formatCompact(r.impressions)} impr.
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <footer className="mt-8 border-t border-zinc-200 pt-4 text-center text-[11px] text-zinc-400">
        Generado por Nate Media · Datos de Metricool · {fmtRange(report.start, report.end)}
      </footer>
    </div>
  )
}
