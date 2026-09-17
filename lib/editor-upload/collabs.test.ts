import { describe, expect, it } from 'vitest'
import { PRIMER_ROUND_CLIENT_ID } from '@/lib/primer-round/constants'
import { defaultIncludeCollabs, resolveEditorUploadCollaborators } from './collabs'

describe('resolveEditorUploadCollaborators', () => {
  it('Primer Round ON → rafaellenin + denniseyperez', () => {
    const collabs = resolveEditorUploadCollaborators({
      clientId: PRIMER_ROUND_CLIENT_ID,
      includeCollabs: true,
    })
    expect(collabs.map((c) => c.username).sort()).toEqual(['denniseyperez', 'rafaellenin'])
  })

  it('Primer Round OFF → no collabs', () => {
    expect(
      resolveEditorUploadCollaborators({
        clientId: PRIMER_ROUND_CLIENT_ID,
        includeCollabs: false,
      }),
    ).toEqual([])
  })

  it('other clients only get typed handles — never invents Primer Round hosts', () => {
    expect(
      resolveEditorUploadCollaborators({
        clientId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        includeCollabs: true,
      }),
    ).toEqual([])
    expect(
      resolveEditorUploadCollaborators({
        clientId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        includeCollabs: true,
        extraUsernames: [' @otrohost ', ''],
      }),
    ).toEqual([{ username: 'otrohost', deleted: false }])
  })

  it('defaults collabs on only for Primer Round', () => {
    expect(defaultIncludeCollabs(PRIMER_ROUND_CLIENT_ID)).toBe(true)
    expect(defaultIncludeCollabs('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')).toBe(false)
  })
})
