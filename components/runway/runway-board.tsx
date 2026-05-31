import { RunwayRow, type RunwayRowData } from './runway-row'

const HEAD = 'py-2 pr-3 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground'

export function RunwayBoard({ rows }: { rows: RunwayRowData[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center">
        <p className="text-sm font-medium text-muted-foreground">No hay clientes activos</p>
        <p className="text-xs text-muted-foreground/70">El runway de contenido aparecerá aquí por cliente.</p>
      </div>
    )
  }
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full">
        <thead>
          <tr className="border-b bg-muted/30">
            <th className={`${HEAD} pl-3`}>Cliente</th>
            <th className={HEAD}>Cadencia</th>
            <th className={HEAD}>Ideas</th>
            <th className={HEAD}>Grabado</th>
            <th className={HEAD}>Editado</th>
            <th className={`${HEAD} pr-3 text-right`}>Estado</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => (
            <RunwayRow key={row.clientId} row={row} />
          ))}
        </tbody>
      </table>
    </div>
  )
}
