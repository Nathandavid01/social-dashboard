import { formatDistance } from 'date-fns'
import { es } from 'date-fns/locale'

export interface AssignRow {
  id: string
  name: string
  assigned_to: string | null
  assigned_designer: string | null
  assignment_changed_by?: string | null
  assignment_changed_at?: string | null
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

export interface EditorTint {
  key: string
  bg: string
  bar: string
  chip: string
}

const MUTED_TINT: EditorTint = {
  key: 'muted',
  bg: 'bg-muted/40',
  bar: 'bg-muted-foreground/40',
  chip: 'bg-muted-foreground',
}

/** Full class names so Tailwind keeps them. */
const EDITOR_TINTS: EditorTint[] = [
  { key: 'sky', bg: 'bg-sky-500/15', bar: 'bg-sky-400', chip: 'bg-sky-500' },
  { key: 'violet', bg: 'bg-violet-500/15', bar: 'bg-violet-400', chip: 'bg-violet-500' },
  { key: 'amber', bg: 'bg-amber-500/15', bar: 'bg-amber-400', chip: 'bg-amber-500' },
  { key: 'emerald', bg: 'bg-emerald-500/15', bar: 'bg-emerald-400', chip: 'bg-emerald-500' },
  { key: 'rose', bg: 'bg-rose-500/15', bar: 'bg-rose-400', chip: 'bg-rose-500' },
  { key: 'teal', bg: 'bg-teal-500/15', bar: 'bg-teal-400', chip: 'bg-teal-500' },
  { key: 'orange', bg: 'bg-orange-500/15', bar: 'bg-orange-400', chip: 'bg-orange-500' },
  { key: 'fuchsia', bg: 'bg-fuchsia-500/15', bar: 'bg-fuchsia-400', chip: 'bg-fuchsia-500' },
]

export function editorTint(id: string | null | undefined, paletteIds: string[] = []): EditorTint {
  if (!id || id === 'sin-editor') return MUTED_TINT
  const fromPalette = paletteIds.indexOf(id)
  if (fromPalette >= 0) return EDITOR_TINTS[fromPalette % EDITOR_TINTS.length]
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 33 + id.charCodeAt(i)) >>> 0
  return EDITOR_TINTS[h % EDITOR_TINTS.length]
}

export function lastChangeLabel(
  changedBy: string | null | undefined,
  at: string | null | undefined,
  members: AssignMember[],
  now: Date = new Date(),
): string | null {
  if (!changedBy && !at) return null
  const name = members.find((m) => m.id === changedBy)?.name?.trim() || 'Alguien'
  if (!at) return `Lo cambió ${name}`
  const ago = formatDistance(new Date(at), now, { addSuffix: true, locale: es })
  return `Lo cambió ${name} · ${ago}`
}
