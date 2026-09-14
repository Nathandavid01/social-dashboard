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
import {
  studioLaneFor,
  groupStudioIdeas,
  primerRoundCtas,
  assertPrimerRoundMp4,
  primerRoundUploadContentType,
  pickPendingPrimerRoundPiece,
  primerRoundSoonScheduleIso,
} from './studio'
import { buildPrimerRoundCaption } from './caption-template'

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
    expect(primerRoundAutopostEnabled({} as unknown as NodeJS.ProcessEnv)).toBe(true)
    expect(primerRoundAutopostEnabled({ PRIMER_ROUND_AUTOPOST: 'false' } as unknown as NodeJS.ProcessEnv)).toBe(false)
  })
})

describe('collabs', () => {
  it('defaults to Denisse + Lenin handles', () => {
    expect(resolvePrimerRoundCollaborators({} as unknown as NodeJS.ProcessEnv)).toEqual([
      { username: 'denniseyperez', deleted: false },
      { username: 'rafaellenin', deleted: false },
    ])
  })

  it('allows env override without inventing extras', () => {
    expect(resolvePrimerRoundCollaborators({ PRIMER_ROUND_COLLAB_USERNAMES: '@a, b' } as unknown as NodeJS.ProcessEnv)).toEqual([
      { username: 'a', deleted: false },
      { username: 'b', deleted: false },
    ])
  })

  it('labels known hosts', () => {
    const labels = primerRoundCollabLabels({} as unknown as NodeJS.ProcessEnv)
    expect(labels[0]).toMatchObject({ username: 'denniseyperez', label: 'Dennise Pérez' })
    expect(labels[1]).toMatchObject({ username: 'rafaellenin' })
  })
})

describe('dual orthography gate (overlay + caption)', () => {
  it('requires both overlay and bottom caption to pass', () => {
    const overlay = overlayFromBurnedCaptions({ text: [
      'Exfiscal Zulma Fúster',
      '¿Qué impacto tendrá',
      'el caso de Elvia Cabrera',
      'en el caso de Anthonieska?',
    ].join('\n'), issues: [] })
    const caption = captionSurfaceFromText(buildPrimerRoundCaption({
      hook: '¿Qué impacto tendrá el caso de Elvia Cabrera en el caso de Anthonieska?',
      guest: 'Exfiscal Zulma Fúster',
    }))
    const gate = buildPrimerRoundOrthoGate({ overlay, caption })
    expect(gate.ok).toBe(true)
    expect(canAutoSchedulePrimerRound({
      gate, overrideOrtho: false, autopostEnabled: true, collabsReady: true,
    }).allowed).toBe(true)
  })

  it('blocks when overlay has typos even if caption is clean', () => {
    const overlay = overlayFromBurnedCaptions({
      text: ['aserca', 'de la noticia', 'del dia'].join('\n'),
      issues: [{ quote: 'aserca', problem: 'ortografía', suggestion: 'acerca' }],
    })
    const caption = captionSurfaceFromText(buildPrimerRoundCaption({
      hook: '¿Hook limpio?',
      guest: 'Invitado Demo',
    }))
    const gate = buildPrimerRoundOrthoGate({ overlay, caption })
    expect(gate.ok).toBe(false)
    expect(canAutoSchedulePrimerRound({
      gate, overrideOrtho: false, autopostEnabled: true, collabsReady: true,
    }).reason).toMatch(/overlay/i)
  })

  it('blocks when caption is missing', () => {
    const overlay = overlayFromBurnedCaptions({ text: [
      'Exfiscal Zulma Fúster',
      '¿Qué impacto tendrá',
      'el caso de Elvia Cabrera',
      'en el caso de Anthonieska?',
    ].join('\n'), issues: [] })
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
    const overlay = [
      'Exfiscal Zulma Fúster',
      '¿Qué impacto tendrá',
      'el caso de Elvia Cabrera',
      'en el caso de Anthonieska?',
    ].join('\n')
    const caption = buildPrimerRoundCaption({
      hook: '¿Hook?',
      guest: 'Invitado',
    })
    const gate = parseDualOrthoLlm(
      '{"overlay_ok":true,"caption_ok":true,"issues":[]}',
      overlay,
      caption,
    )
    expect(gate.ok).toBe(true)
  })
})

describe('pickPendingPrimerRoundPiece', () => {
  it('keeps the latest unpublished studio video and ignores posted / empty leftovers', () => {
    const picked = pickPendingPrimerRoundPiece([
      { id: 'empty', status: 'producida', hasEditedVideo: false, editedUploadedAt: '2026-09-14T00:38:00Z' },
      { id: 'posted', status: 'producida', hasEditedVideo: true, metricool_post_id: 99, editedUploadedAt: '2026-09-14T00:50:00Z' },
      { id: 'old', status: 'producida', hasEditedVideo: true, editedUploadedAt: '2026-09-14T00:40:00Z' },
      { id: 'latest', status: 'producida', hasEditedVideo: true, editedUploadedAt: '2026-09-14T00:45:00Z' },
    ])
    expect(picked?.id).toBe('latest')
  })

  it('prefers a studio-marked upload over a leftover pipeline idea', () => {
    const picked = pickPendingPrimerRoundPiece([
      { id: 'pipeline', status: 'approved', hasEditedVideo: true, studioUpload: false, editedUploadedAt: '2026-09-14T01:00:00Z' },
      { id: 'studio', status: 'pending', hasEditedVideo: true, studioUpload: true, editedUploadedAt: '2026-09-14T00:45:00Z' },
    ])
    expect(picked?.id).toBe('studio')
  })

  it('returns null when there is no unpublished edited video', () => {
    expect(
      pickPendingPrimerRoundPiece([
        { id: 'gone', status: 'descartada', hasEditedVideo: true },
        { id: 'sent', status: 'producida', hasEditedVideo: true, metricool_post_id: 1 },
      ]),
    ).toBeNull()
  })
})

describe('primerRoundSoonScheduleIso', () => {
  it('is a naive PR datetime at least 5 minutes ahead', () => {
    const now = Date.parse('2026-09-14T16:00:00-04:00')
    const iso = primerRoundSoonScheduleIso(now)
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
    expect(iso).toBe('2026-09-14T16:06')
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

describe('assertPrimerRoundMp4', () => {
  it('accepts mp4', () => {
    expect(assertPrimerRoundMp4({ fileName: 'clip.mp4', contentType: 'video/mp4' })).toBeNull()
  })

  it('accepts mov / quicktime (películas de Final Cut / iPhone)', () => {
    expect(assertPrimerRoundMp4({ fileName: 'entrevista.mov', contentType: 'video/quicktime' })).toBeNull()
    expect(assertPrimerRoundMp4({ fileName: 'ENTREVISTA.MOV', contentType: '' })).toBeNull()
    expect(assertPrimerRoundMp4({ fileName: 'clip.mov', contentType: 'video/quicktime' })).toBeNull()
  })

  it('rejects non-video and other containers', () => {
    expect(assertPrimerRoundMp4({ fileName: 'x.html', contentType: 'text/html' })).toMatch(/no permitido/i)
    expect(assertPrimerRoundMp4({ fileName: 'clip.avi', contentType: 'video/x-msvideo' })).toMatch(/mp4|mov/i)
  })
})

describe('primerRoundUploadContentType', () => {
  it('maps a nameless .mov to video/quicktime (Safari a veces manda type vacío)', () => {
    expect(primerRoundUploadContentType({ fileName: 'pelicula.mov', contentType: '' })).toBe('video/quicktime')
    expect(primerRoundUploadContentType({ fileName: 'clip.mp4', contentType: '' })).toBe('video/mp4')
    expect(primerRoundUploadContentType({ fileName: 'x.mov', contentType: 'video/quicktime' })).toBe('video/quicktime')
    expect(primerRoundUploadContentType({ fileName: 'evil.html', contentType: 'text/html' })).toBe('text/html')
  })
})
