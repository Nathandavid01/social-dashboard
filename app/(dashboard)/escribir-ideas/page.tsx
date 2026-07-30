import Link from 'next/link'
import { requirePermission } from '@/lib/auth/server'
import { createClient } from '@/lib/supabase/server'
import { getWrittenIdeas } from '@/lib/actions/ideas-batch'
import { IdeaBatchTable } from '@/components/ideas/idea-batch-table'
import { PenLine, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ESTADOS_VIVOS, estadoLabel, estadoTone } from '@/lib/clients/estado'
import { paraEscribirIdeas } from '@/lib/clients/para-escribir'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Escribir ideas — reemplaza el documento PDF donde se listaban a mano.
 *
 * Cada fila es una content_ideas normal, así que lo escrito aquí aparece solo
 * en On Site para grabarlo y sigue el resto del flujo. Nada que importar
 * después.
 */
export default async function EscribirIdeasPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>
}) {
  await requirePermission('ideas.edit')

  const { c: clientId } = await searchParams
  const supabase = await createClient()

  // No los 66 activos: con esa lista el problema era encontrar el de hoy. Salen
  // los agendados en el calendario y los marcados "próximo a grabar" o "sin
  // contenido" — esas son las dos razones por las que se escriben ideas, y no
  // siempre hay ya una sesión puesta cuando toca escribirlas. El criterio y el
  // orden viven en paraEscribirIdeas.
  const [{ data: sesiones }, { data: clients }] = await Promise.all([
    supabase
      .from('recording_sessions')
      .select('client_id')
      .neq('status', 'cancelled')
      .not('client_id', 'is', null),
    supabase.from('clients').select('id, name, status').in('status', ESTADOS_VIVOS),
  ])

  const agendados = new Set((sesiones ?? []).map((s) => s.client_id as string))
  const lista = paraEscribirIdeas(clients ?? [], agendados)
  const activo = lista.find((x) => x.id === clientId) ?? lista[0]
  const { ideas } = activo ? await getWrittenIdeas(activo.id) : { ideas: [] }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary to-amber-600 text-black">
            <PenLine className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-[15px] font-semibold tracking-tight">Escribir ideas</h1>
            <p className="truncate text-xs text-muted-foreground">
              Solo los clientes agendados para grabar. Una fila por idea.
            </p>
          </div>
        </div>
        <Link
          href="/onsite"
          className="shrink-0 whitespace-nowrap rounded-lg border px-3 py-1.5 text-[12px] transition hover:bg-muted"
        >
          Ir a On Site
        </Link>
      </header>

      {lista.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border bg-card px-4 py-12 text-center">
          <Users className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm font-medium">Ningún cliente pide ideas ahora mismo</p>
          <p className="max-w-md text-xs text-muted-foreground">
            Aquí salen los clientes con sesión en el calendario de grabación y los
            marcados «próximo a grabar» o «sin contenido». Cambia el estado de un
            cliente en su ficha, o agenda una sesión, y aparecerá aquí.
          </p>
          <div className="mt-1 flex flex-wrap justify-center gap-2">
            <Link href="/clients" className="rounded-lg border px-3 py-1.5 text-[12px] transition hover:bg-muted">
              Ver clientes
            </Link>
            <Link href="/recording-calendar" className="rounded-lg border px-3 py-1.5 text-[12px] transition hover:bg-muted">
              Abrir calendario de grabación
            </Link>
          </div>
        </div>
      ) : (
        <>
          <nav className="flex gap-1.5 overflow-x-auto pb-1">
            {lista.map((c) => (
              <Link
                key={c.id}
                href={`/escribir-ideas?c=${c.id}`}
                className={cn(
                  'shrink-0 whitespace-nowrap rounded-lg border px-3 py-1.5 text-[12px] transition',
                  c.id === activo?.id ? 'border-primary bg-primary/10' : 'hover:bg-muted',
                )}
              >
                <span className="flex items-center gap-1.5">
                  {c.name}
                  {c.status !== 'active' && (
                    <span className={cn('rounded-full border px-1.5 text-[9px]', estadoTone(c.status))}>
                      {estadoLabel(c.status)}
                    </span>
                  )}
                </span>
              </Link>
            ))}
          </nav>

          {activo && (
            <IdeaBatchTable
              clientId={activo.id}
              clientName={activo.name}
              existing={ideas ?? []}
            />
          )}
        </>
      )}
    </div>
  )
}
