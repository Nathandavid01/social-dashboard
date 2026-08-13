export interface AssignRow {
  id: string
  name: string
  assigned_to: string | null
  assigned_designer: string | null
}

export interface AssignMember {
  id: string
  name: string
  role: string
}

export type AssignmentPersonFilter = 'todos' | 'sin-asignar' | string

export function isIncomplete(row: AssignRow): boolean {
  return !row.assigned_to || !row.assigned_designer
}

/** People who already have ≥1 client as editor or designer. Sorted by name. */
export function assignedMembers(clients: AssignRow[], members: AssignMember[]): AssignMember[] {
  const ids = new Set<string>()
  for (const c of clients) {
    if (c.assigned_to) ids.add(c.assigned_to)
    if (c.assigned_designer) ids.add(c.assigned_designer)
  }
  return members
    .filter((m) => ids.has(m.id))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

export function filterAssignmentRows(
  clients: AssignRow[],
  opts: {
    query?: string
    soloIncompletos?: boolean
    person?: AssignmentPersonFilter
  } = {},
): AssignRow[] {
  const t = (opts.query ?? '').trim().toLowerCase()
  const person = opts.person ?? 'todos'
  return clients.filter((c) => {
    if (t && !c.name.toLowerCase().includes(t)) return false
    if (opts.soloIncompletos && !isIncomplete(c)) return false
    if (person === 'sin-asignar') return isIncomplete(c)
    if (person !== 'todos') return c.assigned_to === person || c.assigned_designer === person
    return true
  })
}

export interface AssignmentGroup {
  key: string
  label: string
  rows: AssignRow[]
}

/**
 * Groups the (already filtered) list by editor. "Sin editor" first, then
 * each editor who already has clients, by name. Members with zero clients
 * never get a group.
 */
export function groupAssignmentRows(clients: AssignRow[], members: AssignMember[]): AssignmentGroup[] {
  if (clients.length === 0) return []
  const byId = new Map(members.map((m) => [m.id, m]))
  const sinEditor = clients.filter((c) => !c.assigned_to)
  const groups: AssignmentGroup[] = []
  if (sinEditor.length > 0) {
    groups.push({ key: 'sin-editor', label: 'Sin editor', rows: sinEditor })
  }

  const editorIds = new Set<string>()
  for (const c of clients) if (c.assigned_to) editorIds.add(c.assigned_to)
  const editors = Array.from(editorIds)
    .map((id) => ({ id, name: byId.get(id)?.name ?? 'Sin nombre' }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))

  for (const ed of editors) {
    groups.push({
      key: ed.id,
      label: ed.name,
      rows: clients.filter((c) => c.assigned_to === ed.id),
    })
  }
  return groups
}

export function assignmentCount(clients: AssignRow[], memberId: string): number {
  return clients.filter((c) => c.assigned_to === memberId || c.assigned_designer === memberId).length
}
