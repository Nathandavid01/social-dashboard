'use client'

import { useMemo, useState } from 'react'
import { Search, Loader2, Check, AlertCircle, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { setClientAssignment } from '@/lib/actions/client-assignments'
import {
  assignedMembers,
  assignmentCount,
  editorTint,
  filterAssignmentRows,
  groupAssignmentRows,
  isIncomplete,
  lastChangeLabel,
  type AssignMember,
  type AssignmentPersonFilter,
  type AssignRow,
} from '@/lib/utils/assignments-group'

export type { AssignRow, AssignMember as Member }

type Estado = 'guardando' | 'ok' | 'error'

/**
 * Reparto de clientes en una sola pantalla: una fila por cliente, un
 * desplegable por rol. Guarda al cambiar — un botón "Guardar todo" al final
 * invita a perder el trabajo de cincuenta filas por cerrar la pestaña.
 */
export function AssignmentsTable({
  clients,
  members,
  currentUserId = null,
}: {
  clients: AssignRow[]
  members: AssignMember[]
  currentUserId?: string | null
}) {
  const [rows, setRows] = useState(clients)
  const [estado, setEstado] = useState<Record<string, Estado>>({})
  const [q, setQ] = useState('')
  const [soloSinAsignar, setSoloSinAsignar] = useState(false)
  const [person, setPerson] = useState<AssignmentPersonFilter>('todos')

  const editores = useMemo(
    () => members.filter((m) => ['editor', 'supervisor', 'owner'].includes(m.role)),
    [members],
  )
  const disenadores = useMemo(
    () => members.filter((m) => ['disenador', 'supervisor', 'owner'].includes(m.role)),
    [members],
  )

  const yaAsignados = useMemo(() => assignedMembers(rows, members), [rows, members])
  const tintIds = useMemo(() => yaAsignados.map((m) => m.id), [yaAsignados])
  const incompletos = useMemo(() => rows.filter(isIncomplete).length, [rows])

  const visibles = useMemo(
    () => filterAssignmentRows(rows, { query: q, soloIncompletos: soloSinAsignar, person }),
    [rows, q, soloSinAsignar, person],
  )
  const grupos = useMemo(() => groupAssignmentRows(visibles, members), [visibles, members])

  const sinEditor = rows.filter((c) => !c.assigned_to).length
  const sinDisenador = rows.filter((c) => !c.assigned_designer).length

  async function cambiar(clientId: string, campo: 'editor' | 'disenador', userId: string | null) {
    const key = `${clientId}:${campo}`
    // Optimista: la fila se actualiza al momento y solo vuelve atrás si falla.
    const antes = rows.find((r) => r.id === clientId)
    setRows((rs) => rs.map((r) => (r.id === clientId
      ? {
          ...r,
          [campo === 'editor' ? 'assigned_to' : 'assigned_designer']: userId,
          assignment_changed_by: currentUserId,
          assignment_changed_at: new Date().toISOString(),
        }
      : r)))
    setEstado((e) => ({ ...e, [key]: 'guardando' }))

    const res = await setClientAssignment({ clientId, campo, userId })
    if (res.error) {
      setRows((rs) => rs.map((r) => (r.id === clientId && antes ? antes : r)))
      setEstado((e) => ({ ...e, [key]: 'error' }))
      return
    }
    setEstado((e) => ({ ...e, [key]: 'ok' }))
    setTimeout(() => setEstado((e) => {
      const next = { ...e }
      delete next[key]
      return next
    }), 1500)
  }

  return (
    <div className="space-y-4 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <h1 className="truncate text-[15px] font-semibold tracking-tight">Asignaciones</h1>
          <p className="truncate text-xs text-muted-foreground">
            {rows.length} clientes · {sinEditor} sin editor · {sinDisenador} sin diseñador
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <input
              type="checkbox"
              checked={soloSinAsignar}
              onChange={(e) => setSoloSinAsignar(e.target.checked)}
              className="h-3.5 w-3.5"
            />
            Solo incompletos
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar cliente…"
              aria-label="Buscar cliente"
              className="h-8 w-56 rounded-md border bg-muted/50 pl-8 pr-3 text-xs outline-none placeholder:text-muted-foreground/70 focus:border-primary/50"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setPerson('todos')}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-medium transition',
            person === 'todos'
              ? 'border-border bg-muted text-foreground'
              : 'border-transparent text-muted-foreground hover:bg-muted/60',
          )}
        >
          <Users className="h-3.5 w-3.5" aria-hidden />
          Todos
          <span className="tabular-nums text-muted-foreground/70">{rows.length}</span>
        </button>
        <button
          type="button"
          onClick={() => setPerson('sin-asignar')}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-medium transition',
            person === 'sin-asignar'
              ? 'border-border bg-muted text-foreground'
              : 'border-transparent text-muted-foreground hover:bg-muted/60',
          )}
        >
          Sin asignar
          <span className="tabular-nums text-muted-foreground/70">{incompletos}</span>
        </button>
        {yaAsignados.map((m) => (
          <button
            type="button"
            key={m.id}
            onClick={() => setPerson(m.id)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium transition',
              person === m.id
                ? 'border-border bg-muted text-foreground'
                : 'border-transparent text-muted-foreground hover:bg-muted/60',
            )}
          >
            <span className={cn('grid h-4 w-4 place-items-center rounded-full text-[9px] font-bold text-white', editorTint(m.id, tintIds).chip)}>
              {m.name.slice(0, 1).toUpperCase()}
            </span>
            {m.name}
            <span className="tabular-nums text-muted-foreground/70">{assignmentCount(rows, m.id)}</span>
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="pb-2 pr-3 font-medium">Cliente</th>
              <th className="pb-2 pr-3 font-medium">Editor</th>
              <th className="pb-2 pr-3 font-medium">Diseñador</th>
              <th className="pb-2 font-medium">Último cambio</th>
            </tr>
          </thead>
          {grupos.map((g) => {
            const tint = editorTint(g.key === 'sin-editor' ? null : g.key, tintIds)
            return (
            <tbody key={g.key} aria-label={g.label}>
              <tr data-editor-tint={tint.key} className={cn('border-b border-border/60', tint.bg)}>
                <td colSpan={4} className="py-1.5 pr-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <span className="inline-flex items-center gap-2">
                    <span className={cn('h-2 w-2 shrink-0 rounded-full', tint.bar)} aria-hidden />
                    {g.label}
                    <span className="font-medium normal-case tabular-nums text-muted-foreground/70">
                      {g.rows.length}
                    </span>
                  </span>
                </td>
              </tr>
              {g.rows.map((c) => (
                <tr key={c.id} className={cn('border-b border-border/50 last:border-0', tint.bg)}>
                  <td className="py-2 pr-3">
                    <span className="flex items-center gap-2">
                      <span className={cn('h-6 w-0.5 shrink-0 rounded-full', tint.bar)} aria-hidden />
                      <span className="block max-w-[220px] truncate">{c.name}</span>
                    </span>
                  </td>
                  {(['editor', 'disenador'] as const).map((campo) => {
                    const valor = campo === 'editor' ? c.assigned_to : c.assigned_designer
                    const opciones = campo === 'editor' ? editores : disenadores
                    const st = estado[`${c.id}:${campo}`]
                    return (
                      <td key={campo} className="py-2 pr-3">
                        <div className="flex items-center gap-1.5">
                          <select
                            aria-label={`${campo === 'editor' ? 'Editor' : 'Diseñador'} de ${c.name}`}
                            value={valor ?? ''}
                            onChange={(e) => cambiar(c.id, campo, e.target.value || null)}
                            className={cn(
                              'h-8 w-full max-w-[200px] rounded-md border bg-background px-2 text-xs outline-none focus:border-primary/50',
                              !valor && 'text-muted-foreground',
                            )}
                          >
                            <option value="">Sin asignar</option>
                            {opciones.map((m) => (
                              <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                          </select>
                          {st === 'guardando' && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" aria-hidden="true" />}
                          {st === 'ok' && <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" aria-hidden="true" />}
                          {st === 'error' && <AlertCircle className="h-3.5 w-3.5 shrink-0 text-destructive" aria-label="No se pudo guardar" />}
                        </div>
                      </td>
                    )
                  })}
                  <td className="py-2 text-[11px] text-muted-foreground">
                    {lastChangeLabel(c.assignment_changed_by, c.assignment_changed_at, members) ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            )
          })}
        </table>

        {visibles.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Ningún cliente coincide.
          </p>
        )}
      </div>
    </div>
  )
}
