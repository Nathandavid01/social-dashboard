import { describe, it, expect } from 'vitest'
import { canAssignRole } from './role-assignment'
import type { UserRole } from '@/lib/supabase/types'

const check = (actor: UserRole | null, targetCurrent: UserRole | null, next: UserRole, isSelf = false) =>
  canAssignRole({ actor, targetCurrent, next, isSelf })

describe('canAssignRole — owner', () => {
  it('puede asignar cualquier rol', () => {
    for (const r of ['owner', 'supervisor', 'copy', 'editor', 'disenador', 'video'] as const) {
      expect(check('owner', 'editor', r).ok).toBe(true)
    }
  })
  it('puede cambiar el rol de otro owner', () => {
    expect(check('owner', 'owner', 'editor').ok).toBe(true)
  })
})

describe('canAssignRole — supervisor', () => {
  it('reparte los roles de ejecución', () => {
    for (const r of ['copy', 'editor', 'disenador', 'video'] as const) {
      expect(check('supervisor', null, r).ok).toBe(true)
    }
  })

  it('NO puede crear owners ni supervisores — sería ascenderse por delegación', () => {
    expect(check('supervisor', 'editor', 'owner').ok).toBe(false)
    expect(check('supervisor', 'editor', 'supervisor').ok).toBe(false)
  })

  it('NO puede tocar a un owner ni a otro supervisor', () => {
    expect(check('supervisor', 'owner', 'editor').ok).toBe(false)
    expect(check('supervisor', 'supervisor', 'editor').ok).toBe(false)
  })

  it('NO puede cambiarse a sí mismo', () => {
    expect(check('supervisor', 'supervisor', 'editor', true).ok).toBe(false)
  })

  it('el motivo explica qué falta, no solo que no se puede', () => {
    expect(check('supervisor', 'editor', 'owner').reason).toMatch(/no puede asignar/i)
    expect(check('supervisor', 'owner', 'editor').reason).toMatch(/solo un owner/i)
  })
})

describe('canAssignRole — el resto', () => {
  it('editor, copy, diseñador y videógrafo no asignan nada', () => {
    for (const r of ['editor', 'copy', 'disenador', 'video'] as const) {
      expect(check(r, 'editor', 'editor').ok).toBe(false)
    }
  })
  it('sin rol tampoco — falla cerrado', () => {
    expect(check(null, 'editor', 'editor').ok).toBe(false)
  })
})
