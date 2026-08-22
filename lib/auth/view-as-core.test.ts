import { describe, expect, it } from 'vitest'
import {
  canStartViewAs,
  isViewAsEditorId,
  resolveEffectiveRole,
  resolveEffectiveUserId,
  viewAsTargetOk,
} from './view-as-core'

const EDITOR = '11111111-1111-4111-8111-111111111111'

describe('canStartViewAs', () => {
  it('solo owner y supervisor', () => {
    expect(canStartViewAs('owner')).toBe(true)
    expect(canStartViewAs('supervisor')).toBe(true)
    expect(canStartViewAs('editor')).toBe(false)
    expect(canStartViewAs('copy')).toBe(false)
    expect(canStartViewAs(null)).toBe(false)
  })
})

describe('isViewAsEditorId', () => {
  it('acepta un uuid y rechaza basura', () => {
    expect(isViewAsEditorId(EDITOR)).toBe(true)
    expect(isViewAsEditorId('no-es-uuid')).toBe(false)
    expect(isViewAsEditorId('')).toBe(false)
    expect(isViewAsEditorId(null)).toBe(false)
  })
})

describe('viewAsTargetOk', () => {
  it('solo un editor activo y aprobado', () => {
    expect(viewAsTargetOk({ role: 'editor', status: 'active', approval_status: 'approved' })).toBe(true)
    expect(viewAsTargetOk({ role: 'editor', status: 'inactive', approval_status: 'approved' })).toBe(false)
    expect(viewAsTargetOk({ role: 'disenador', status: 'active', approval_status: 'approved' })).toBe(false)
    expect(viewAsTargetOk({ role: 'editor', status: 'active', approval_status: 'pending' })).toBe(false)
    expect(viewAsTargetOk(null)).toBe(false)
  })
})

describe('resolveEffectiveRole', () => {
  it('el admin con cookie válida se ve como editor', () => {
    expect(resolveEffectiveRole('owner', EDITOR)).toBe('editor')
    expect(resolveEffectiveRole('supervisor', EDITOR)).toBe('editor')
  })

  it('un editor no puede impersonarse a otro por cookie', () => {
    expect(resolveEffectiveRole('editor', EDITOR)).toBe('editor')
  })

  it('cookie inválida o ausente deja el rol real', () => {
    expect(resolveEffectiveRole('owner', 'basura')).toBe('owner')
    expect(resolveEffectiveRole('owner', null)).toBe('owner')
  })
})

describe('resolveEffectiveUserId', () => {
  it('el admin hereda el id del editor elegido', () => {
    expect(resolveEffectiveUserId('admin-1', 'owner', EDITOR)).toBe(EDITOR)
  })

  it('sin vista, sigue siendo él', () => {
    expect(resolveEffectiveUserId('admin-1', 'owner', null)).toBe('admin-1')
  })

  it('un no-admin ignora la cookie', () => {
    expect(resolveEffectiveUserId('editor-1', 'editor', EDITOR)).toBe('editor-1')
  })
})
