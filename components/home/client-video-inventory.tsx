'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type { ClientVideoInventoryRow } from '@/lib/utils/client-video-inventory'

export function ClientVideoInventory({ rows, checkedAt }: { rows: ClientVideoInventoryRow[]; checkedAt: string }) {
  const [search, setSearch] = useState('')
  const query = search.trim().toLocaleLowerCase('es')
  const visible = rows.filter((row) => `${row.clientName} ${row.editors.join(' ')}`.toLocaleLowerCase('es').includes(query))
  return <Card>
    <CardHeader className="flex flex-wrap flex-row items-center justify-between gap-x-3 gap-y-2">
      <div className="min-w-0"><CardTitle className="text-base">Videos sin publicar por cliente</CardTitle><p className="mt-1 text-xs text-muted-foreground">Una pieza por idea, aunque tenga varias tomas o versiones.</p></div>
      <Input aria-label="Buscar cliente o editor" placeholder="Buscar cliente o editor…" value={search} onChange={(event) => setSearch(event.target.value)} className="w-full sm:w-64" />
    </CardHeader>
    <CardContent>
      <div className="overflow-x-auto"><table className="w-full text-sm">
        <thead><tr className="border-b text-left text-xs text-muted-foreground"><th scope="col" className="py-3 pr-4">Cliente</th><th scope="col" className="pr-4">Editor asignado</th><th scope="col" className="px-3 text-right">Editados</th><th scope="col" className="px-3 text-right">Crudos sin editar</th><th scope="col" className="pl-3 text-right">Programados</th></tr></thead>
        <tbody>{visible.map((row) => <tr key={row.clientId} className="border-b last:border-0">
          <th scope="row" className="py-3 pr-4 text-left font-medium"><Link href={`/clients/${row.clientId}`} className="hover:text-primary">{row.clientName}</Link>{row.status !== 'active' && <span className="ml-2 text-xs font-normal text-muted-foreground">{row.status === 'paused' ? 'En pausa' : row.status === 'archived' ? 'Archivado' : row.status}</span>}{row.unverified > 0 && <p className="mt-1 text-xs font-normal text-amber-600 dark:text-amber-400">{row.unverified} pieza{row.unverified === 1 ? '' : 's'} por verificar</p>}</th>
          <td className="pr-4 text-muted-foreground">{row.editors.join(' · ') || 'Sin asignar'}</td>
          <td className="px-3 text-right tabular-nums">{row.edited}</td><td className="px-3 text-right tabular-nums">{row.raw}</td><td className="pl-3 text-right tabular-nums">{row.scheduled ?? <span className="text-xs text-amber-600 dark:text-amber-400">Sin verificar</span>}</td>
        </tr>)}</tbody>
      </table></div>
      {visible.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No hay clientes que coincidan.</p>}
      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">Editados incluye los programados que tienen archivo editado; no sumes ambas columnas. Crudos cuenta piezas con material original y sin editado. Programados cuenta videos confirmados en Metricool, incluidos los cargados directamente allí. Se excluyen publicaciones registradas y posts publicados en cualquiera de sus redes. Las piezas vinculadas que no se puedan verificar quedan fuera de los conteos.</p>
      <p className="mt-2 text-xs text-muted-foreground">Consulta: {new Date(checkedAt).toLocaleString('es-PR', { timeZone: 'America/Puerto_Rico' })} · Fuentes: dashboard y Metricool. Las publicaciones externas no vinculadas requieren conciliación.</p>
    </CardContent>
  </Card>
}
