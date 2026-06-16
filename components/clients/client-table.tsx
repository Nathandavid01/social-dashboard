'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { deleteClient } from '@/lib/actions/clients'
import type { Client } from '@/lib/supabase/types'
import { useToast } from '@/lib/hooks/use-toast'
import { StatusBadge } from './status-badge'
import { PlatformBadges } from './platform-badges'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { MoreHorizontal, Pencil, Trash2, Eye, Search, Brain, Zap, Sparkles, Globe, Clapperboard, UserPlus, Users } from 'lucide-react'
import { EmptyState } from '@/components/shared/empty-state'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

interface ClientTableProps {
  clients: Client[]
}

export function ClientTable({ clients }: ClientTableProps) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [isPending, startTransition] = useTransition()
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const { toast } = useToast()

  const filtered = clients.filter((c) => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || c.status === statusFilter
    return matchSearch && matchStatus
  })

  function confirmDelete() {
    if (!deleteTarget) return
    const { id, name } = deleteTarget
    startTransition(async () => {
      const result = await deleteClient(id)
      if (result.error) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' })
      } else {
        toast({ title: 'Cliente eliminado', description: `${name} ha sido eliminado.` })
        setDeleteTarget(null)
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar clientes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Todos los estados" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="active">Activo</SelectItem>
            <SelectItem value="paused">Pausado</SelectItem>
            <SelectItem value="onboarding">Onboarding</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        clients.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Aún no tienes clientes"
            description="Agrega tu primer cliente para empezar a planificar y publicar su contenido."
            action={
              <Button asChild>
                <Link href="/clients/new">
                  <UserPlus className="mr-2 h-4 w-4" />
                  Agregar cliente
                </Link>
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={Search}
            title="Sin resultados"
            description="Ningún cliente coincide con tu búsqueda o filtros."
            action={
              <Button
                variant="outline"
                onClick={() => {
                  setSearch('')
                  setStatusFilter('all')
                }}
              >
                Limpiar filtros
              </Button>
            }
          />
        )
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead className="hidden md:table-cell">Industria</TableHead>
                <TableHead className="hidden sm:table-cell">Plataformas</TableHead>
                <TableHead className="hidden md:table-cell">Metricool</TableHead>
                <TableHead className="hidden md:table-cell">IA</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((client) => (
                <TableRow key={client.id}>
                  <TableCell className="font-medium">
                    <Link href={`/clients/${client.id}`} className="hover:text-primary transition-colors">
                      {client.name}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                    {client.industry || '—'}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <PlatformBadges platforms={client.platforms} />
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {client.metricool_blog_id ? (
                      <span title="Metricool conectado" className="inline-flex items-center gap-1 text-xs font-medium text-yellow-600">
                        <Zap className="h-3.5 w-3.5 text-yellow-500" /> Conectado
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {client.brand_voice ? (
                      <span title="Perfil de IA configurado" className="inline-flex items-center gap-1 text-xs font-medium text-purple-600">
                        <Brain className="h-3.5 w-3.5 text-purple-500" /> Listo
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={client.status} />
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" disabled={isPending}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/clients/${client.id}`}>
                            <Eye className="mr-2 h-4 w-4" />
                            Ver
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/clients/${client.id}/batch`}>
                            <Clapperboard className="mr-2 h-4 w-4" />
                            Lote de videos
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/clients/${client.id}/edit`}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/clients/${client.id}?tab=captions`}>
                            <Sparkles className="mr-2 h-4 w-4" />
                            Ver captions
                          </Link>
                        </DropdownMenuItem>
                        {client.metricool_blog_id && (
                          <DropdownMenuItem asChild>
                            <Link href={`/published?blogId=${client.metricool_blog_id}`}>
                              <Globe className="mr-2 h-4 w-4" />
                              Ver publicados
                            </Link>
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive cursor-pointer"
                          onClick={() => setDeleteTarget({ id: client.id, name: client.name })}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={`¿Eliminar a ${deleteTarget?.name ?? ''}?`}
        description="Esto borra el cliente y su información asociada. No se puede deshacer."
        confirmLabel="Eliminar"
        destructive
        loading={isPending}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
