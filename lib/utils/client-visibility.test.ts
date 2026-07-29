import { describe, it, expect } from 'vitest'
import { clientsForUser, visibleClientIds, type AssignableClient } from './client-visibility'

const CLIENTS: AssignableClient[] = [
  { id: 'c1', name: 'Nora Fitness', assigned_to: 'ana', assigned_designer: null },
  { id: 'c2', name: 'Gym Titan', assigned_to: 'beto', assigned_designer: null },
  { id: 'c3', name: 'Surf School', assigned_to: null, assigned_designer: null },
]

const names = (cs: { name: string }[]) => cs.map((c) => c.name)

describe('clientsForUser — which clients an editor may submit for', () => {
  it('an owner sees every client', () => {
    expect(names(clientsForUser('owner', 'ana', CLIENTS))).toEqual(['Nora Fitness', 'Gym Titan', 'Surf School'])
  })
  it('a supervisor sees every client', () => {
    expect(names(clientsForUser('supervisor', 'ana', CLIENTS))).toHaveLength(3)
  })
  it('an editor sees only the clients assigned to them', () => {
    expect(names(clientsForUser('editor', 'ana', CLIENTS))).toEqual(['Nora Fitness'])
    expect(names(clientsForUser('editor', 'beto', CLIENTS))).toEqual(['Gym Titan'])
  })
  it('a videografo is scoped the same way as an editor', () => {
    expect(names(clientsForUser('video', 'beto', CLIENTS))).toEqual(['Gym Titan'])
  })
  it('legacy team_member is scoped like an editor', () => {
    expect(names(clientsForUser('team_member', 'ana', CLIENTS))).toEqual(['Nora Fitness'])
  })
  it('an unassigned client belongs to nobody but is still visible to owners', () => {
    expect(names(clientsForUser('editor', 'ana', [CLIENTS[2]]))).toEqual([])
    expect(names(clientsForUser('owner', 'ana', [CLIENTS[2]]))).toEqual(['Surf School'])
  })
  it('an editor with no assignments gets an empty list, not everything', () => {
    expect(clientsForUser('editor', 'nadie', CLIENTS)).toEqual([])
  })
  it('a missing role or user id is treated as no access, never as full access', () => {
    expect(clientsForUser(null, 'ana', CLIENTS)).toEqual([])
    expect(clientsForUser('editor', null, CLIENTS)).toEqual([])
  })
})

describe('visibleClientIds — qué trabajo ve cada quien', () => {
  it('owner, supervisor y copy ven todo: no hay filtro', () => {
    for (const r of ['owner', 'supervisor', 'copy'] as const) {
      expect(visibleClientIds(r, 'ana', CLIENTS)).toBeNull()
    }
  })

  it('un editor solo ve sus clientes asignados', () => {
    const ids = visibleClientIds('editor', 'ana', CLIENTS)
    expect(ids).toEqual(new Set(['c1']))
  })

  it('un editor sin asignaciones no ve nada — Set vacío, no null', () => {
    const ids = visibleClientIds('editor', 'nadie', CLIENTS)
    expect(ids).toEqual(new Set())
    expect(ids).not.toBeNull()
  })

  it('sin rol o sin sesión no ve nada', () => {
    expect(visibleClientIds(null, 'ana', CLIENTS)).toEqual(new Set())
    expect(visibleClientIds('editor', null, CLIENTS)).toEqual(new Set())
  })

  it('un cliente sin asignar no es de nadie', () => {
    expect(visibleClientIds('editor', 'ana', [CLIENTS[2]])).toEqual(new Set())
  })
})

describe('editor y diseñador no se pisan', () => {
  const MIXTO: AssignableClient[] = [
    { id: 'c1', name: 'Solo editor',    assigned_to: 'ana',  assigned_designer: null },
    { id: 'c2', name: 'Solo diseñador', assigned_to: null,   assigned_designer: 'dani' },
    { id: 'c3', name: 'Los dos',        assigned_to: 'ana',  assigned_designer: 'dani' },
  ]

  it('el editor ve donde es EDITOR, no donde hay diseñador', () => {
    expect(visibleClientIds('editor', 'ana', MIXTO)).toEqual(new Set(['c1', 'c3']))
  })

  it('el diseñador ve donde es DISEÑADOR', () => {
    expect(visibleClientIds('disenador', 'dani', MIXTO)).toEqual(new Set(['c2', 'c3']))
  })

  it('ser diseñador de un cliente no te da lo que edita otro', () => {
    expect(visibleClientIds('disenador', 'ana', MIXTO)).toEqual(new Set())
  })
})
