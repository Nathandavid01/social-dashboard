import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/server'
import { getReachDiagnostic } from '@/lib/actions/agency-reach'

export const dynamic = 'force-dynamic'

/**
 * Owner/metricool diagnostic for the login reach counter. Tells you whether the
 * number is REAL (from Metricool) or the counter is hidden because there's no
 * data — and why (env missing, no client blogIds, per-account failures).
 * Visit while logged in: GET /api/reach-status
 */
export async function GET() {
  try {
    await requirePermission('metricool.read')
  } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const d = await getReachDiagnostic()
  return NextResponse.json({
    source: d.total != null ? 'metricool (real)' : 'sin datos — el contador no se muestra',
    metricoolConfigured: d.configured,
    clientsWithMetricoolBlog: d.clientsWithBlog,
    accountsReached: d.perBlog.filter((b) => b.ok).length,
    accountsFailed: d.perBlog.filter((b) => !b.ok).length,
    windowDays: 365,
    totalReach: d.total,
    perBlog: d.perBlog,
    hint: !d.configured
      ? 'Falta METRICOOL_TOKEN / METRICOOL_USER_ID en el entorno de Vercel.'
      : d.clientsWithBlog === 0
        ? 'Ningún cliente tiene metricool_blog_id configurado.'
        : d.total == null
          ? 'Metricool no devolvió reach para esas cuentas (revisa accountsFailed / permisos de insights).'
          : 'Todo bien: el contador del login muestra este total.',
  })
}
