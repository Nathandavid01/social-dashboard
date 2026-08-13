import { describe, expect, it } from 'vitest'
import {
  assignedMembers,
  editorTint,
  filterAssignmentRows,
  groupAssignmentRows,
  lastChangeLabel,
  type AssignRow,
  type AssignMember,
} from './assignments-group'

const members: AssignMember[] = [
  { id: 'jeander', name: 'Jeander Loop', role: 'editor' },
  { id: 'lisneidy', name: 'Lisneidy Lopez', role: 'editor' },
  { id: 'joxandra', name: 'Joxandra Vilchez', role: 'disenador' },
  { id: 'idle', name: 'Sin cartera', role: 'editor' },
]

const clients: AssignRow[] = [
  { id: 'aa', name: 'AA Real Estate', assigned_to: 'jeander', assigned_designer: null },
  { id: 'beyond', name: 'Beyond PVC', assigned_to: 'jeander', assigned_designer: null },
  { id: 'blend', name: 'Blend Salon', assigned_to: 'lisneidy', assigned_designer: null },
  { id: 'bosque', name: 'Café El Bosque', assigned_to: 'lisneidy', assigned_designer: 'joxandra' },
  { id: 'anibal', name: 'Anibal Fuentes PNP', assigned_to: null, assigned_designer: null },
]

describe('assignedMembers', () => {
  it('returns only people who already have at least one client', () => {
    const got = assignedMembers(clients, members)
    expect(got.map((m) => m.id)).toEqual(['jeander', 'joxandra', 'lisneidy'])
  })

  it('returns [] when there are no clients or nobody is assigned', () => {
    expect(assignedMembers([], members)).toEqual([])
    expect(
      assignedMembers(
        [{ id: 'x', name: 'X', assigned_to: null, assigned_designer: null }],
        members,
      ),
    ).toEqual([])
  })
})

describe('filterAssignmentRows', () => {
  it('keeps every row for todos and filters by search', () => {
    expect(filterAssignmentRows(clients, { person: 'todos' })).toHaveLength(5)
    expect(filterAssignmentRows(clients, { person: 'todos', query: 'blend' }).map((c) => c.id)).toEqual([
      'blend',
    ])
  })

  it('sin-asignar / incompletos keep rows missing editor or designer', () => {
    const incompletos = filterAssignmentRows(clients, { person: 'sin-asignar' }).map((c) => c.id)
    expect(incompletos).toEqual(['aa', 'beyond', 'blend', 'anibal'])
    expect(
      filterAssignmentRows(clients, { person: 'todos', soloIncompletos: true }).map((c) => c.id),
    ).toEqual(incompletos)
  })

  it('a person filter gathers every client they already have, as editor or designer', () => {
    expect(filterAssignmentRows(clients, { person: 'jeander' }).map((c) => c.id)).toEqual([
      'aa',
      'beyond',
    ])
    expect(filterAssignmentRows(clients, { person: 'joxandra' }).map((c) => c.id)).toEqual(['bosque'])
  })
})

describe('groupAssignmentRows', () => {
  it('puts Sin editor first, then one group per editor who already has clients', () => {
    const groups = groupAssignmentRows(clients, members)
    expect(groups.map((g) => g.key)).toEqual(['sin-editor', 'jeander', 'lisneidy'])
    expect(groups[0].label).toBe('Sin editor')
    expect(groups[0].rows.map((r) => r.id)).toEqual(['anibal'])
    expect(groups[1].rows.map((r) => r.id)).toEqual(['aa', 'beyond'])
    expect(groups[2].rows.map((r) => r.id)).toEqual(['blend', 'bosque'])
  })

  it('does not invent a group for a member with zero clients', () => {
    const keys = groupAssignmentRows(clients, members).map((g) => g.key)
    expect(keys).not.toContain('idle')
  })

  it('returns no groups when the list is empty', () => {
    expect(groupAssignmentRows([], members)).toEqual([])
  })
})

describe('editorTint', () => {
  it('is stable for the same editor and muted when there is no editor', () => {
    expect(editorTint('jeander')).toEqual(editorTint('jeander'))
    expect(editorTint(null).key).toBe('muted')
    expect(editorTint('sin-editor').key).toBe('muted')
  })

  it('gives two known editors different tints so groups are visually distinct', () => {
    const order = ['jeander', 'lisneidy']
    expect(editorTint('jeander', order).bg).not.toBe(editorTint('lisneidy', order).bg)
  })
})

describe('lastChangeLabel', () => {
  const people: AssignMember[] = [{ id: 'eric', name: 'Eric Pérez', role: 'owner' }]
  const now = new Date('2026-08-13T15:00:00.000Z')

  it('returns null when nobody has changed the row', () => {
    expect(lastChangeLabel(null, null, people, now)).toBeNull()
  })

  it('names the person who made the change and how long ago', () => {
    const label = lastChangeLabel('eric', '2026-08-13T14:00:00.000Z', people, now)
    expect(label).toContain('Eric Pérez')
    expect(label).toMatch(/hace/)
  })

  it('falls back to Alguien if the actor left the team', () => {
    expect(lastChangeLabel('gone', '2026-08-13T14:00:00.000Z', people, now)).toContain('Alguien')
  })
})
