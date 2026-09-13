import { describe, it, expect } from 'vitest'
import {
  PRIMER_ROUND_CLIENT_ID,
  PRIMER_ROUND_BLOG_ID,
  PRIMER_ROUND_DEFAULT_COLLABS,
  isPrimerRoundClientId,
  primerRoundAutopostEnabled,
} from './constants'
import { resolvePrimerRoundCollaborators, primerRoundCollabLabels } from './collabs'
import {
  overlayFromBurnedCaptions,
  captionSurfaceFromText,
  buildPrimerRoundOrthoGate,
  canAutoSchedulePrimerRound,
  parseDualOrthoLlm,
} from './orthography'
import { studioLaneFor, groupStudioIdeas, primerRoundCtas } from './studio'

describe('Primer Round constants', () => {
  it('locks client + blog + host collabs', () => {
    expect(PRIMER_ROUND_CLIENT_ID).toBe('7f4a8757-7811-4fb4-afc0-87dc0c50c56d')
    expect(PRIMER_ROUND_BLOG_ID).toBe('5476146')
    expect(PRIMER_ROUND_DEFAULT_COLLABS.map((c) => c.username)).toEqual([
      'denniseyperez',
      'rafaellenin',
    ])
  })

  it('detects the Primer Round client id', () => {
    expect(isPrimerRoundClientId(PRIMER_ROUND_CLIENT_ID)).toBe(true)
    expect(isPrimerRoundClientId('other')).toBe(false)
  })

  it('autopost defaults on; kill switch is PRIMER_ROUND_AUTOPOST=false', () => {
    expect(primerRoundAutopostEnabled({})).toBe(true)
    expect(primerRoundAutopostEnabled({ PRIMER_ROUND_AUTOPOST: 'false' })).toBe(false)
  })
})

describe('collabs', () => {
  it('defaults to Denisse + Lenin handles', () => {
    expect(resolvePrimerRoundCollaborators({})).toEqual([
      { username: 'denniseyperez', deleted: false },
      { username: 'rafaellenin', deleted: false },
    ])
  })

  it('allows env override without inventing extras', () => {
    expect(resolvePrimerRoundCollaborators({ PRIMER_ROUND_COLLAB_USERNAMES: '@a, b' })).toEqual([
      { username: 'a', deleted: false },
      { username: 'b', deleted: false },
    ])
  })

  it('labels known hosts', () => {
    const labels = primerRoundCollabLabels({})
    expect(labels[0]).toMatchObject({ username: 'denniseyperez', label: 'Dennise Pérez' })
    expect(labels[1]).toMatchObject({ username: 'rafaellenin' })
  })
})

describe('dual orthography gate (overlay + caption)', () => {
  it('requires both overlay and bottom caption to pass', () => {
    const overlay = overlayFromBurnedCaptions({ text: 'Hoy en Primer Round', issues: [] })
    const caption = captionSurfaceFromText('Escucha Primer Round en Magic 97.3')
    const gate = buildPrimerRoundOrthoGate({ overlay, caption })
    expect(gate.ok).toBe(true)
    expect(canAutoSchedulePrimerRound({
      gate, overrideOrtho: false, autopostEnabled: true, collabsReady: true,
    }).allowed).toBe(true)
  })

  it('blocks when overlay has typos even if caption is clean', () => {
    const overlay = overlayFromBurnedCaptions({
      text: 'aserca',
      issues: [{ quote: 'aserca', problem: 'ortografía', suggestion: 'acerca' }],
    })
    const caption = captionSurfaceFromText('Caption limpio')
    const gate = buildPrimerRoundOrthoGate({ overlay, caption })
    expect(gate.ok).toBe(false)
    expect(canAutoSchedulePrimerRound({
      gate, overrideOrtho: false, autopostEnabled: true, collabsReady: true,
    }).reason).toMatch(/overlay/i)
  })

  it('blocks when caption is missing', () => {
    const overlay = overlayFromBurnedCaptions({ text: 'OK', issues: [] })
    const caption = captionSurfaceFromText('')
    const gate = buildPrimerRoundOrthoGate({ overlay, caption })
    expect(canAutoSchedulePrimerRound({
      gate, overrideOrtho: false, autopostEnabled: true, collabsReady: true,
    }).allowed).toBe(false)
  })

  it('allows Eric override', () => {
    const overlay = overlayFromBurnedCaptions({ text: '', issues: [] })
    const caption = captionSurfaceFromText('')
    const gate = buildPrimerRoundOrthoGate({ overlay, caption })
    expect(canAutoSchedulePrimerRound({
      gate, overrideOrtho: true, autopostEnabled: true, collabsReady: true,
    }).allowed).toBe(true)
  })

  it('parses dual LLM JSON', () => {
    const gate = parseDualOrthoLlm(
      '{"overlay_ok":true,"caption_ok":true,"issues":[]}',
      'Hoy',
      'Escucha el show',
    )
    expect(gate.ok).toBe(true)
  })
})

describe('studio lanes', () => {
  it('maps statuses to lanes', () => {
    expect(studioLaneFor({ id: '1', title: 'a', status: 'idea', approval_status: 'pending' })).toBe('ideas')
    expect(studioLaneFor({ id: '2', title: 'b', status: 'grabada', approval_status: 'pending', hasRawVideo: true })).toBe('bank')
    expect(studioLaneFor({ id: '3', title: 'c', status: 'producida', approval_status: 'pending', hasEditedVideo: true })).toBe('editing')
    expect(studioLaneFor({ id: '4', title: 'd', status: 'producida', approval_status: 'submitted' })).toBe('review')
    expect(studioLaneFor({ id: '5', title: 'e', status: 'producida', approval_status: 'approved' })).toBe('ready')
  })

  it('groups ideas and builds CTAs', () => {
    const g = groupStudioIdeas([
      { id: '1', title: 'a', status: 'idea', approval_status: null },
      { id: '2', title: 'b', status: 'grabada', approval_status: null },
    ])
    expect(g.ideas).toHaveLength(1)
    expect(g.bank).toHaveLength(1)
    expect(primerRoundCtas('cid').ideas).toContain('c=cid')
  })
})
