import type { OperationsOverview, OverviewItem } from './operations-overview'

/** Present the same snapshot as Mi día; do not calculate a competing workflow. */
export function formatOperationsBriefing(result: {data?: OperationsOverview; error?: string} | null): string {
  if (!result) return 'Resumen Operativo: Sin acceso al resumen del equipo. No inferir que no hay pendientes.'
  if (result.error || !result.data) return `Resumen Operativo Sin Verificar: ${result.error || 'No se pudo cargar'}. No inferir cero pendientes.`
  const data = result.data
  const lines = [
    `Resumen Operativo · ${data.date} · Misma Fuente Que Mi Día`,
    `Hoy: ${data.today.length} · Subidas: ${data.uploads.length} · Revisión: ${data.reviews.length} · Correcciones: ${data.corrections.length} · Listos Para Agendar: ${data.ready.length} · Bloqueados: ${data.blocked.length} · Atrasados: ${data.overdue.length}`,
    'Enviado no significa publicado. La publicación debe confirmarse en Metricool.',
  ]
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
