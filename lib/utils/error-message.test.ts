import { describe, it, expect } from 'vitest'
import { friendlyError } from './error-message'

describe('friendlyError', () => {
  it('returns a generic message for empty/nullish input', () => {
    const generic = 'Algo salió mal. Vuelve a intentarlo.'
    expect(friendlyError(undefined)).toBe(generic)
    expect(friendlyError(null)).toBe(generic)
    expect(friendlyError('')).toBe(generic)
    expect(friendlyError('   ')).toBe(generic)
  })

  it('passes through short, human Spanish messages unchanged', () => {
    expect(friendlyError('El nombre es obligatorio')).toBe('El nombre es obligatorio')
    expect(friendlyError('No tienes permiso para esta acción')).toBe(
      'No tienes permiso para esta acción',
    )
  })

  it('maps not-null / required constraint violations to friendly copy', () => {
    expect(
      friendlyError('null value in column "name" violates not-null constraint'),
    ).toBe('Falta un campo obligatorio.')
    expect(friendlyError('violates not-null constraint')).toBe(
      'Falta un campo obligatorio.',
    )
  })

  it('maps unique constraint violations to friendly copy', () => {
    expect(
      friendlyError(
        'duplicate key value violates unique constraint "clients_name_key"',
      ),
    ).toBe('Ya existe un registro con esos datos.')
  })

  it('maps foreign-key violations to friendly copy', () => {
    expect(
      friendlyError('violates foreign key constraint "ideas_client_id_fkey"'),
    ).toBe('No se puede completar: hay datos relacionados.')
  })

  it('maps RLS / permission errors to friendly copy', () => {
    expect(
      friendlyError('new row violates row-level security policy for table "clients"'),
    ).toBe('No tienes permiso para realizar esta acción.')
    expect(friendlyError('permission denied for table profiles')).toBe(
      'No tienes permiso para realizar esta acción.',
    )
  })

  it('maps network/fetch failures to friendly copy', () => {
    expect(friendlyError('TypeError: Failed to fetch')).toBe(
      'Problema de conexión. Revisa tu internet e inténtalo otra vez.',
    )
    expect(friendlyError('fetch failed')).toBe(
      'Problema de conexión. Revisa tu internet e inténtalo otra vez.',
    )
  })

  it('hides raw SQL / stack-trace noise behind the generic message', () => {
    const generic = 'Algo salió mal. Vuelve a intentarlo.'
    expect(friendlyError('PostgrestException: 42804 SQLSTATE')).toBe(generic)
    expect(
      friendlyError('Error: select * from public.clients where ...'),
    ).toBe(generic)
    expect(friendlyError('at Object.<anonymous> (/app/foo.js:1:1)')).toBe(generic)
  })

  it('accepts Error objects, not just strings', () => {
    expect(friendlyError(new Error('El correo ya está en uso'))).toBe(
      'El correo ya está en uso',
    )
    expect(friendlyError(new Error('violates not-null constraint'))).toBe(
      'Falta un campo obligatorio.',
    )
  })
})
