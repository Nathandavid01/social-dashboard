import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getRevisionPublica } from '@/lib/actions/entregas-client-review'
import { AprobacionCliente } from '@/components/entregas/aprobacion-cliente'

// El token es único y su estado cambia cuando el cliente vota: nunca cachear.
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export const metadata: Metadata = {
  title: 'Aprobar video | NMedia PR',
  robots: { index: false, follow: false },
}

/**
 * Lo que abre el cliente desde el enlace que le mandan por WhatsApp. Sin login:
 * el token es la credencial, y el filtrado pasa dentro de una función
 * SECURITY DEFINER, no aquí.
 */
export default async function AprobacionPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const revision = await getRevisionPublica(token)
  if (!revision) notFound()

  return <AprobacionCliente revision={revision} token={token} nowISO={new Date().toISOString()} />
}
