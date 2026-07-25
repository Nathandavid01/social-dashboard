import { describe, it, expect } from 'vitest'
import { clientsForUser, type AssignableClient } from './client-visibility'

const CLIENTS: AssignableClient[] = [
  { id: 'c1', name: 'Nora Fitness', assigned_to: 'ana' },
  { id: 'c2', name: 'Gym Titan', assigned_to: 'beto' },
  { id: 'c3', name: 'Surf School', assigned_to: null },
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
