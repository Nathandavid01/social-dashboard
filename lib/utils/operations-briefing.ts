import { reconcileTodayChecklist } from './reconcile-today-checklist'
import type { OperationalPublicationReport } from './operational-publications'
import type { OperationsOverview, OverviewItem } from './operations-overview'

/** Present the same snapshot as Mi día; do not calculate a competing workflow. */
export function formatOperationsBriefing(result: {data?: OperationsOverview; error?: string} | null, publication?: {report?: OperationalPublicationReport; error?: string}): string {
  if (!result) return 'Resumen Operativo: Sin acceso al resumen del equipo. No inferir que no hay pendientes.'
  if (result.error || !result.data) return `Resumen Operativo Sin Verificar: ${result.error || 'No se pudo cargar'}. No inferir cero pendientes.`
  const data = {...result.data, today: reconcileTodayChecklist(result.data.today, result.data.date, publication?.report ?? null)}
  const lines = [
    `Resumen Operativo · ${data.date} · Misma Fuente Que Mi Día`,
    `Hoy: ${data.today.length} · Subidas: ${data.uploads.length} · Revisión: ${data.reviews.length} · Correcciones: ${data.corrections.length} · Listos Para Agendar: ${data.ready.length} · Bloqueados: ${data.blocked.length} · Atrasados: ${data.overdue.length}`,
    `Publicados Hoy: ${data.today.filter(item => item.done).length} · Por Publicar Hoy: ${data.today.filter(item => !item.done).length}` ,
    'Enviado no significa publicado. La publicación debe confirmarse en Metricool.',
  ]
  if (publication?.error || (publication && !publication.report)) lines.push(`No se confirmó la conciliación con Metricool: ${publication.error || 'sin reporte'}. Los pendientes locales pueden incluir publicaciones externas aún sin comprobar.`)
  if (publication?.report?.clients.some(client => client.error)) lines.push('Conciliación Parcial: las cuentas con error conservan sus pendientes locales sin confirmar.')
  const section = (label: string, items: OverviewItem[]) => {
    if (!items.length) return
    lines.push(`${label} (${items.length}):`)
    for (const item of items.slice(0, 8)) lines.push(`• ${item.client} — ${item.title} — ${item.owner} — ${item.state} — ${item.date || 'Sin fecha'}\n  ${item.checks.map(check => `${check.label}: ${check.done ? 'completo' : 'pendiente'}`).join(' · ')}\n  ${item.href}`)
    if (items.length > 8) lines.push(`… ${items.length - 8} más. Lista completa en /mi-dia; el total incluye todos.`)
  }
  section('Checklist De Hoy', data.today)
  section('Revisión', data.reviews)
  section('Correcciones', data.corrections)
  section('Listos Para Agendar', data.ready)
  section('Bloqueados', data.blocked)
  section('Atrasados', data.overdue)
  lines.push('Espacios De Edición:')
  for (const editor of data.editors) lines.push(`• ${editor.name}: ${editor.used}/${editor.limit} ocupados · ${editor.free} libres`)
  return lines.join('\n')
}
