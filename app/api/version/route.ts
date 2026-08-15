import { NextResponse } from 'next/server'
import { APP_VERSION } from '@/lib/version'

// La versión que corre EL SERVIDOR ahora mismo. UpdateNotice la compara con la
// del bundle del navegador para avisar "hay una versión nueva". Force-dynamic:
// una respuesta cacheada devolvería la versión vieja y el aviso nunca saldría.
export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({ version: APP_VERSION })
}
