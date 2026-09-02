import { describe, it, expect } from 'vitest'
import {
  ideaPostReadiness,
  buildPublishDateTime,
  resolvePlatforms,
  pickEditedVideoForPublish,
  resolveVideoForPublish,
  inferWatchBoard,
  type PostableIdea,
} from './idea-posting-core'

const ready: PostableIdea = {
  approval_status: 'approved',
  generated_caption: 'Un caption listo ✨ #post',
  status: 'producida',
  published_at: null,
  metricool_post_id: null,
  posted_at: null,
}

const BLOG = 'blog-1'

describe('ideaPostReadiness', () => {
  it('is ready when approved + caption + edited video + blog id + not posted/published', () => {
    expect(ideaPostReadiness(ready, true, BLOG)).toEqual({ ready: true })
  })

  it('never re-posts once metricool_post_id is set (idempotency, checked first)', () => {
    const r = ideaPostReadiness({ ...ready, metricool_post_id: 12345 }, true, BLOG)
    expect(r.ready).toBe(false)
    expect(r.reason).toMatch(/ya se publicó/i)
  })

  it('never re-posts once posted_at is set — backstop even if Metricool returned no id', () => {
    const r = ideaPostReadiness({ ...ready, posted_at: '2026-07-02T10:00:00Z' }, true, BLOG)
    expect(r.ready).toBe(false)
    expect(r.reason).toMatch(/ya se publicó/i)
  })

  it('blocks when not approved', () => {
    expect(ideaPostReadiness({ ...ready, approval_status: 'submitted' }, true, BLOG).ready).toBe(false)
  })

  it('blocks when the caption is missing or blank', () => {
    expect(ideaPostReadiness({ ...ready, generated_caption: null }, true, BLOG).ready).toBe(false)
    expect(ideaPostReadiness({ ...ready, generated_caption: '   ' }, true, BLOG).ready).toBe(false)
  })

  it('blocks when there is no edited video', () => {
    expect(ideaPostReadiness(ready, false, BLOG).reason).toMatch(/video editado/i)
  })

  it('blocks when already published', () => {
    expect(ideaPostReadiness({ ...ready, published_at: '2026-06-01' }, true, BLOG).ready).toBe(false)
    expect(ideaPostReadiness({ ...ready, status: 'publicada' }, true, BLOG).ready).toBe(false)
  })

  it('refuses (safety) when the client has no Metricool blog id — never posts to the default account', () => {
    expect(ideaPostReadiness(ready, true, null).ready).toBe(false)
    expect(ideaPostReadiness(ready, true, '   ').ready).toBe(false)
    expect(ideaPostReadiness(ready, true, undefined).reason).toMatch(/blog_id/i)
  })
})

describe('buildPublishDateTime', () => {
  const NOW = Date.UTC(2026, 5, 1, 12, 0, 0) // 2026-06-01T12:00:00Z

  it('schedules at the planned publish_date + the client posting_time', () => {
    expect(buildPublishDateTime('2026-06-15', '14:30', NOW)).toBe('2026-06-15T14:30:00')
  })

  it('defaults to 10:00 when the client has no posting_time', () => {
    expect(buildPublishDateTime('2026-06-15', null, NOW)).toBe('2026-06-15T10:00:00')
  })

  it('falls back to +24h from now when there is no planned date', () => {
    expect(buildPublishDateTime(null, '10:00', NOW)).toBe('2026-06-02T12:00:00')
  })

  it('clamps a PAST planned date to +24h so an overdue approval cannot publish immediately', () => {
    // planned 2026-05-20 is before "now" (2026-06-01) → fall back, not the past date
    expect(buildPublishDateTime('2026-05-20', '14:30', NOW)).toBe('2026-06-02T12:00:00')
  })
})

describe('resolvePlatforms', () => {
  it('prefers the client platforms, lowercased', () => {
    expect(resolvePlatforms(['Instagram', 'TikTok'], ['facebook'])).toEqual(['instagram', 'tiktok'])
  })
  it('falls back to default_platforms, then to the IG/FB/TikTok default', () => {
    expect(resolvePlatforms(null, ['Facebook'])).toEqual(['facebook'])
    expect(resolvePlatforms([], [])).toEqual(['instagram', 'facebook', 'tiktok'])
  })
})

describe('pickEditedVideoForPublish', () => {
  const lastWeekPipeline = {
    id: 'old-r2',
    idea_id: 'idea-this-week',
    drive_file_id: 'ideas/x/edited/last-week.mp4',
    storage_provider: 'r2',
    kind: 'edited',
    status: 'uploaded',
    uploaded_at: '2026-08-12T18:00:00Z',
  }
  const thisWeekEntregas = {
    id: 'new-ent',
    idea_id: 'idea-this-week',
    drive_file_id: 'entregas/x/edited/this-week.mp4',
    storage_provider: 'entregas-r2',
    kind: 'edited',
    status: 'uploaded',
    uploaded_at: '2026-08-06T10:00:00Z',
  }

  it('does not send last week’s pipeline file when this week lives in Entregas', () => {
    const picked = pickEditedVideoForPublish([lastWeekPipeline, thisWeekEntregas])
    expect(picked?.id).toBe('new-ent')
    expect(picked?.drive_file_id).toContain('this-week')
  })

  it('never picks another idea’s file from the same client', () => {
    const lastWeekOtherIdea = {
      ...lastWeekPipeline,
      id: 'other-idea-file',
      idea_id: 'idea-last-week',
      drive_file_id: 'entregas/last-week/edited/old.mp4',
      storage_provider: 'entregas-r2',
      uploaded_at: '2026-08-13T20:00:00Z',
    }
    const picked = pickEditedVideoForPublish([lastWeekOtherIdea, thisWeekEntregas], {
      ideaId: 'idea-this-week',
    })
    expect(picked?.id).toBe('new-ent')
    expect(picked?.idea_id).toBe('idea-this-week')
  })

  it('when they approved on the pipeline, does not swap in an Entregas leftover', () => {
    const picked = pickEditedVideoForPublish([lastWeekPipeline, thisWeekEntregas], {
      ideaId: 'idea-this-week',
      watchedOn: 'pipeline',
    })
    expect(picked?.id).toBe('old-r2')
  })

  it('fails closed if the watched board has no live file', () => {
    expect(
      pickEditedVideoForPublish([thisWeekEntregas], {
        ideaId: 'idea-this-week',
        watchedOn: 'pipeline',
      }),
    ).toBeNull()
    expect(
      pickEditedVideoForPublish([lastWeekPipeline], {
        ideaId: 'idea-this-week',
        watchedOn: 'entregas',
      }),
    ).toBeNull()
  })

  it('board-agnostic approve uses Entregas, not last week’s pipeline file', () => {
    expect(inferWatchBoard([lastWeekPipeline, thisWeekEntregas], 'idea-this-week')).toBe('entregas')
    const picked = pickEditedVideoForPublish([lastWeekPipeline, thisWeekEntregas], {
      ideaId: 'idea-this-week',
    })
    expect(picked?.id).toBe('new-ent')
  })

  it('when they approved on Entregas, does not swap in a pipeline leftover', () => {
    const picked = pickEditedVideoForPublish([lastWeekPipeline, thisWeekEntregas], {
      ideaId: 'idea-this-week',
      watchedOn: 'entregas',
    })
    expect(picked?.id).toBe('new-ent')
  })

  it('uses the file the copywriter previewed, even if another edited is newer', () => {
    const picked = pickEditedVideoForPublish([lastWeekPipeline, thisWeekEntregas], {
      preferredId: 'new-ent',
    })
    expect(picked?.id).toBe('new-ent')
  })

  it('ignores a preferred id that is not a live edited file on this idea', () => {
    const picked = pickEditedVideoForPublish([lastWeekPipeline, thisWeekEntregas], {
      preferredId: 'other-idea-video',
    })
    expect(picked?.id).toBe('new-ent')
  })

  it('skips archived leftovers', () => {
    const picked = pickEditedVideoForPublish([
      { ...lastWeekPipeline, status: 'archived' },
      thisWeekEntregas,
    ])
    expect(picked?.id).toBe('new-ent')
  })

  it('falls back to the newest pipeline file when there is no Entregas cut', () => {
    const older = { ...lastWeekPipeline, id: 'older', uploaded_at: '2026-08-01T00:00:00Z' }
    const newer = { ...lastWeekPipeline, id: 'newer', uploaded_at: '2026-08-10T00:00:00Z' }
    expect(pickEditedVideoForPublish([older, newer])?.id).toBe('newer')
  })

  it('returns null when there is no usable edited file', () => {
    expect(pickEditedVideoForPublish([])).toBeNull()
    expect(pickEditedVideoForPublish([{ ...thisWeekEntregas, drive_file_id: null }])).toBeNull()
  })
})

/**
 * Cadena de custodia: el archivo que se publica tiene que ser EXACTAMENTE el
 * que se aprobó. Antes de esto, `preferredId` era una preferencia blanda — si
 * el archivo aprobado estaba archivado, se caía en silencio al edited más
 * nuevo y se publicaba un corte que nadie aprobó.
 */
describe('resolveVideoForPublish — el aprobado es contrato, no preferencia', () => {
  const aprobado = {
    id: 'v-aprobado',
    idea_id: 'idea-1',
    drive_file_id: 'ideas/1/edited/aprobado.mp4',
    storage_provider: 'r2',
    kind: 'edited',
    status: 'uploaded',
    uploaded_at: '2026-08-20T10:00:00Z',
  }
  const masNuevoSinAprobar = {
    id: 'v-nuevo',
    idea_id: 'idea-1',
    drive_file_id: 'ideas/1/edited/nuevo.mp4',
    storage_provider: 'r2',
    kind: 'edited',
    status: 'uploaded',
    uploaded_at: '2026-08-27T10:00:00Z',
  }

  it('con sello publica el aprobado, aunque haya un corte más nuevo', () => {
    const res = resolveVideoForPublish([aprobado, masNuevoSinAprobar], {
      ideaId: 'idea-1',
      approvedVideoId: 'v-aprobado',
    })
    expect(res.video?.id).toBe('v-aprobado')
    expect(res.skipped).toBeUndefined()
  })

  it('si el archivo aprobado se archivó, NO publica otro: falla explícito', () => {
    const res = resolveVideoForPublish(
      [{ ...aprobado, status: 'archived' }, masNuevoSinAprobar],
      { ideaId: 'idea-1', approvedVideoId: 'v-aprobado' },
    )
    expect(res.video).toBeNull()
    expect(res.skipped).toBe('El archivo aprobado ya no está disponible')
  })

  it('si el archivo aprobado ya no existe, tampoco publica otro', () => {
    const res = resolveVideoForPublish([masNuevoSinAprobar], {
      ideaId: 'idea-1',
      approvedVideoId: 'v-aprobado',
    })
    expect(res.video).toBeNull()
    expect(res.skipped).toBe('El archivo aprobado ya no está disponible')
  })

  it('el sello manda por encima del tablero: no se cambia de bandeja', () => {
    const enEntregas = { ...masNuevoSinAprobar, id: 'v-ent', storage_provider: 'entregas-r2' }
    const res = resolveVideoForPublish([aprobado, enEntregas], {
      ideaId: 'idea-1',
      approvedVideoId: 'v-aprobado',
      watchedOn: 'entregas',
    })
    expect(res.video?.id).toBe('v-aprobado')
  })

  it('sin sello (ideas viejas) se comporta igual que siempre', () => {
    const res = resolveVideoForPublish([aprobado, masNuevoSinAprobar], { ideaId: 'idea-1' })
    expect(res.video?.id).toBe('v-nuevo')
    expect(res.skipped).toBeUndefined()
  })

  it('sin ningún edited vivo no inventa nada', () => {
    const res = resolveVideoForPublish([], { ideaId: 'idea-1', approvedVideoId: 'v-aprobado' })
    expect(res.video).toBeNull()
    expect(res.skipped).toBe('El archivo aprobado ya no está disponible')
  })

  it('un sello que apunta a un video de OTRA idea no vale', () => {
    const deOtraIdea = { ...aprobado, idea_id: 'idea-2' }
    const res = resolveVideoForPublish([deOtraIdea], {
      ideaId: 'idea-1',
      approvedVideoId: 'v-aprobado',
    })
    expect(res.video).toBeNull()
    expect(res.skipped).toBe('El archivo aprobado ya no está disponible')
  })

  it('pickEditedVideoForPublish sigue siendo la misma lógica, sin duplicarla', () => {
    expect(
      pickEditedVideoForPublish([aprobado, masNuevoSinAprobar], { ideaId: 'idea-1' })?.id,
    ).toBe(resolveVideoForPublish([aprobado, masNuevoSinAprobar], { ideaId: 'idea-1' }).video?.id)
  })
})

describe('buildPublishDateTime — horario por día del cliente', () => {
  const NOW = Date.UTC(2026, 5, 1, 12, 0, 0)
  it('usa el override de posting_schedule del día de la semana del publish_date', () => {
    // 2026-06-15 es lunes (1). Lunes a las 09:00 por override; default 14:30.
    expect(buildPublishDateTime('2026-06-15', '14:30', NOW, { '1': '09:00' })).toBe('2026-06-15T09:00:00')
  })
  it('sin override para ese día, usa posting_time', () => {
    expect(buildPublishDateTime('2026-06-16', '14:30', NOW, { '1': '09:00' })).toBe('2026-06-16T14:30:00')
  })
  it('"hoy" se decide en hora de Puerto Rico, no en UTC', () => {
    // 2026-06-16 01:00 UTC = 2026-06-15 21:00 en PR: el 15 sigue siendo hoy y se respeta.
    const lateUtc = Date.UTC(2026, 5, 16, 1, 0, 0)
    expect(buildPublishDateTime('2026-06-15', '22:00', lateUtc)).toBe('2026-06-15T22:00:00')
  })
})
