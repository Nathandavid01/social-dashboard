'use client'

import { useState } from 'react'
import { auditUpcomingPublications } from '@/lib/actions/publication-audit'
import type { PublicationAuditReport } from '@/lib/utils/publication-audit'

export function PublicationAuditPanel() {
  const [report,setReport] = useState<PublicationAuditReport|null>(null)
  const [error,setError] = useState('')
  const [loading,setLoading] = useState(false)
  async function check() {
    setLoading(true);setError('');setReport(null)
    try {
      const result=await auditUpcomingPublications()
      if(result.error)setError(result.error)
      else if(result.report)setReport(result.report)
    } catch {setError('No se pudo verificar el flujo. Inténtalo de nuevo.')}
    finally {setLoading(false)}
  }
  return <section className="min-w-0 rounded-xl border border-amber-500/25 bg-card p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0"><h2 className="font-semibold">¿Qué está listo para publicarse?</h2><p className="mt-1 text-sm text-muted-foreground">Desde mañana, próximos 14 días · hora de Puerto Rico.</p></div>
      <button className="min-h-11 rounded-lg bg-amber-400 px-4 text-sm font-semibold text-black disabled:opacity-50" disabled={loading} onClick={check}>{loading?'Verificando…':'Verificar en Metricool'}</button>
    </div>
    <p className="mt-3 text-sm text-muted-foreground">Los borradores no se publican, aunque tengan una fecha. Esta comprobación solo consulta el estado.</p>
    {error&&<p role="alert" className="mt-3 text-sm text-red-400">{error}</p>}
    {report&&<div className="mt-4 space-y-3" aria-live="polite">
      <p className="text-sm">{report.start} → {report.end} · Comprobado {new Date(report.checkedAt).toLocaleTimeString('es-PR',{timeZone:'America/Puerto_Rico'})}</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{[
        ['Programadas',report.rows.reduce((n,r)=>n+r.scheduled,0)],
        ['Borradores',report.rows.reduce((n,r)=>n+r.drafts,0)],
        ['Requieren atención',report.rows.reduce((n,r)=>n+r.failed+r.manual,0)],
        ['Sin verificar',report.rows.filter(r=>r.error).length],
      ].map(([label,count])=><div key={label} className="rounded-lg border p-3"><p className="text-2xl font-semibold">{count}</p><p className="text-xs text-muted-foreground">{label}</p></div>)}</div>
      <details><summary className="cursor-pointer py-3 text-sm">Ver situación por cliente ({report.rows.length})</summary><ul className="grid gap-2 md:grid-cols-2">{report.rows.map(row=><li key={row.id} className="min-w-0 rounded-lg border p-3 text-sm"><p className="font-medium break-words">{row.name}</p>{row.error?<p className="text-amber-400">{row.error}</p>:<p className="mt-1 text-muted-foreground">{row.scheduled} programadas · {row.drafts} borradores · {row.failed+row.manual} requieren atención</p>}<p className="mt-1 text-xs text-muted-foreground">{row.planned} tarjetas fechadas en el dashboard</p>{!row.error&&!row.scheduled&&<p className="mt-1 text-xs text-amber-400">Sin publicaciones automáticas listas en este rango</p>}</li>)}</ul></details>
    </div>}
  </section>
}
