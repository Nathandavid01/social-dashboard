import { describe, it, expect } from 'vitest'
import { PRIMER_ROUND_CLIENT_ID } from '@/lib/primer-round/constants'
import { resolveStudioCollaborators, sanitizeCollabUsernames, studioNeedsDefaultCollabs } from './collabs'

describe('sanitizeCollabUsernames', () => {
  it('strips @, drops empty, de-dupes', () => {
    expect(sanitizeCollabUsernames(['@rafaellenin', 'denniseyperez', 'rafaellenin', '  '])).toEqual([
      'rafaellenin',
      'denniseyperez',
    ])
  })
})

describe('resolveStudioCollaborators', () => {
  it('defaults Primer Round to rafaellenin + denniseyperez', () => {
    const collabs = resolveStudioCollaborators({ clientId: PRIMER_ROUND_CLIENT_ID })
    expect(collabs.map((c) => c.username).sort()).toEqual(['denniseyperez', 'rafaellenin'])
    expect(collabs.every((c) => c.deleted === false)).toBe(true)
    expect(studioNeedsDefaultCollabs(PRIMER_ROUND_CLIENT_ID)).toBe(true)
  })

  it('honors explicit usernames over the Primer Round default', () => {
    expect(
      resolveStudioCollaborators({
        clientId: PRIMER_ROUND_CLIENT_ID,
        usernames: ['@rafaellenin'],
      }).map((c) => c.username),
    ).toEqual(['rafaellenin'])
  })

  it('does not invent collabs for other clients', () => {
    expect(resolveStudioCollaborators({ clientId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' })).toEqual([])
    expect(studioNeedsDefaultCollabs('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')).toBe(false)
  })

  it('includeCollabs=false skips even Primer Round hosts', () => {
    expect(
      resolveStudioCollaborators({ clientId: PRIMER_ROUND_CLIENT_ID, includeCollabs: false }),
    ).toEqual([])
  })
})
