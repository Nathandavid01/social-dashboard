import { describe, expect, it } from 'vitest'
import {
  applyEditingClaim,
  decideEditingClaim,
  decideEditingRelease,
  editingClaimConflictMessage,
  editingClaimFromFields,
  editingClaimLabel,
  formatEditingClaimWhen,
  isEditingClaimed,
} from './editing-claim'

const maria = { byId: 'ed-maria', byName: 'María R.', at: '2026-09-21T15:00:00.000Z' }

describe('editingClaimFromFields', () => {
  it('trata editing_started_by como el candado: sin by no hay claim aunque quede un timestamp', () => {
    expect(editingClaimFromFields(null, '2026-09-21T15:00:00.000Z', 'María')).toEqual({
      byId: null,
      byName: null,
      at: null,
    })
    expect(isEditingClaimed(editingClaimFromFields(null, '2026-09-21T15:00:00.000Z'))).toBe(false)
  })

  it('guarda quién y cuándo cuando hay by', () => {
    expect(editingClaimFromFields('ed-maria', '2026-09-21T15:00:00.000Z', 'María R.')).toEqual(maria)
    expect(isEditingClaimed(maria)).toBe(true)
  })
})

describe('decideEditingClaim', () => {
  it('deja reclamar un video libre', () => {
    expect(decideEditingClaim(null, 'ed-diego')).toEqual({ ok: true, kind: 'claim' })
    expect(decideEditingClaim(editingClaimFromFields(null, null), 'ed-diego')).toEqual({ ok: true, kind: 'claim' })
  })

  it('es idempotente si ya lo tengo yo', () => {
    expect(decideEditingClaim(maria, 'ed-maria')).toEqual({ ok: true, kind: 'already-mine' })
  })

  it('conflicto si otra persona ya lo reclamó', () => {
    expect(decideEditingClaim(maria, 'ed-diego')).toEqual({
      ok: false,
      reason: 'taken',
      holder: maria,
    })
    expect(editingClaimConflictMessage(maria)).toBe('Este video ya lo está editando María R.')
  })

  it('pide sesión para reclamar', () => {
    expect(decideEditingClaim(null, null).ok).toBe(false)
  })
})

describe('decideEditingRelease', () => {
  it('el dueño o un admin puede soltar; otro editor no', () => {
    expect(decideEditingRelease(maria, 'ed-maria')).toEqual({ ok: true, kind: 'release' })
    expect(decideEditingRelease(maria, 'ed-diego', true)).toEqual({ ok: true, kind: 'release' })
    expect(decideEditingRelease(maria, 'ed-diego', false)).toEqual({
      ok: false,
      reason: 'not-holder',
      holder: maria,
    })
  })

  it('soltar un video libre no es error', () => {
    expect(decideEditingRelease(null, 'ed-maria')).toEqual({ ok: true, kind: 'already-free' })
  })
})

describe('applyEditingClaim + label', () => {
  it('escribe quién y cuándo en un claim nuevo', () => {
    expect(applyEditingClaim(null, 'ed-diego', '2026-09-21T16:10:00.000Z', 'Diego V.')).toEqual({
      byId: 'ed-diego',
      byName: 'Diego V.',
      at: '2026-09-21T16:10:00.000Z',
    })
  })

  it('no pisa el claim de otra persona', () => {
    expect(applyEditingClaim(maria, 'ed-diego', '2026-09-21T16:10:00.000Z', 'Diego V.')).toEqual(maria)
  })

  it('muestra En edición — nombre o tú', () => {
    expect(editingClaimLabel(maria, 'ed-diego')).toBe('En edición — María R.')
    expect(editingClaimLabel(maria, 'ed-maria')).toBe('En edición — tú')
    expect(editingClaimLabel(null, 'ed-diego')).toBeNull()
  })
})

describe('formatEditingClaimWhen', () => {
  const now = new Date(2026, 8, 21, 16, 10, 0)

  it('dice ahora / hace N min / hoy HH:mm', () => {
    expect(formatEditingClaimWhen(new Date(2026, 8, 21, 16, 9, 40).toISOString(), now)).toBe('ahora')
    expect(formatEditingClaimWhen(new Date(2026, 8, 21, 15, 55, 0).toISOString(), now)).toBe('hace 15 min')
    expect(formatEditingClaimWhen(new Date(2026, 8, 21, 8, 5, 0).toISOString(), now)).toBe('hoy 08:05')
  })
})
