import 'server-only'

/**
 * Gate compartido para TODAS las rutas /api/cron/*.
 *
 * Regla de oro: falla cerrado. Antes, cada ruta aceptaba `x-vercel-cron`
 * (cualquier cliente puede mandar esa cabecera en un curl) como señal
 * suficiente de autorización — la auditoría lo explotó desde internet. Ahora
 * SOLO `Authorization: Bearer <CRON_SECRET>` autoriza, y si `CRON_SECRET` no
 * está configurado en el entorno la ruta NUNCA ejecuta (503), nunca "abre"
 * por defecto.
 *
 * Vercel manda automáticamente `Authorization: Bearer <CRON_SECRET>` en sus
 * invocaciones programadas cuando el proyecto tiene esa variable configurada
 * (Project Settings → Environment Variables, entorno Production). Ver
 * docs/CRON_VERCEL_SETUP en el reporte de seguridad para el checklist.
 */
export function cronAuthDenial(req: Request): { status: number; body: { error: string } } | null {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return { status: 503, body: { error: 'CRON_SECRET no está configurado' } }
  }
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${secret}`) {
    return { status: 401, body: { error: 'No autorizado' } }
  }
  return null
}
