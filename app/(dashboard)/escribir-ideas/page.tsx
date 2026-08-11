import Link from 'next/link'
import { requirePermission } from '@/lib/auth/server'
import { createClient } from '@/lib/supabase/server'
import { getWrittenIdeas } from '@/lib/actions/ideas-batch'
import { getIdeaDraft } from '@/lib/actions/idea-drafts'
import { IdeaBatchTable } from '@/components/ideas/idea-batch-table'
import { PenLine, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

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

  // Solo los clientes agendados en el calendario de grabación. Escribir ideas
  // para un cliente que nadie va a grabar es trabajo que se queda ahí; y con
  // los 66 activos, encontrar el de hoy era el problema.
  const { data: sesiones } = await supabase
    .from('recording_sessions')
    .select('client_id')
    .neq('status', 'cancelled')
    .not('client_id', 'is', null)

  const agendados = new Set((sesiones ?? []).map((s) => s.client_id as string))

  const { data: clients } = agendados.size === 0
    ? { data: [] }
    : await supabase
        .from('clients')
        .select('id, name')
        .eq('status', 'active')
        .in('id', Array.from(agendados))
        .order('name')

  const lista = clients ?? []
  const activo = lista.find((x) => x.id === clientId) ?? lista[0]
  const { ideas } = activo ? await getWrittenIdeas(activo.id) : { ideas: [] }
  // Lo que esta persona dejó a medio escribir para este cliente.
  const { rows: draft } = activo ? await getIdeaDraft(activo.id) : { rows: null }

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
          <p className="text-sm font-medium">Ningún cliente agendado para grabar</p>
          <p className="max-w-md text-xs text-muted-foreground">
            Aquí solo salen los clientes con una sesión en el calendario de grabación.
            Agenda una sesión —y asígnale cliente— y aparecerá para escribirle ideas.
          </p>
          <Link href="/recording-calendar" className="mt-1 rounded-lg border px-3 py-1.5 text-[12px] transition hover:bg-muted">
            Abrir calendario de grabación
          </Link>
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
                {c.name}
              </Link>
            ))}
          </nav>

          {activo && (
            <IdeaBatchTable
              // La `key` es el arreglo del bug: cambiar de cliente navega dentro
              // de la MISMA ruta, así que sin ella React reusaba el componente y
              // lo tecleado para un cliente se guardaba en el siguiente.
              key={activo.id}
              clientId={activo.id}
              clientName={activo.name}
              existing={ideas ?? []}
              draft={draft}
            />
          )}
        </>
      )}
    </div>
  )
}
