import { describe, expect, it } from 'vitest'
import {
  buildClientPoolPanel,
  canCreateMetricoolSchedule,
  canReschedulePoolIdea,
  canSendHumanReciboToPool,
  humanPoolGate,
  isCalendarEligible,
  poolPublishState,
  shouldNotifyClientVote,
  weekCadenceDates,
  type PoolClientInput,
  type PoolIdeaInput,
  type PoolStateInput,
} from './client-pool-state'

const WEEK = { desde: '2026-09-21', hasta: '2026-09-27' }

function idea(over: Partial<PoolStateInput> = {}): PoolStateInput {
  return {
    status: 'producida',
    published_at: null,
    manual_posted_status: null,
    metricool_post_id: null,
    posted_at: null,
    staff_client_approval: null,
    client_review_status: null,
    entregas_review_status: null,
    client_edit_mode: 'ai',
    ...over,
  }
}

describe('poolPublishState — recibo → Listo → Agendado → Publicado', () => {
  it('queda en recibo hasta que el cliente AI aprueba', () => {
    expect(poolPublishState(idea())).toBe('recibo')
    expect(poolPublishState(idea({ client_edit_mode: 'human', staff_client_approval: 'approved' }))).toBe('recibo')
  })

  it('Listo: cliente AI aprobado por Recibo, /aprobacion o client_review_status', () => {
    expect(poolPublishState(idea({ staff_client_approval: 'approved' }))).toBe('listo')
    expect(poolPublishState(idea({ entregas_review_status: 'approved' }))).toBe('listo')
    expect(poolPublishState(idea({ client_review_status: 'approved' }))).toBe('listo')
  })

  it('no mete un video humano de Entregas al pool aunque el cliente haya votado', () => {
    expect(poolPublishState(idea({
      client_edit_mode: 'human',
      entregas_review_status: 'approved',
      client_review_status: 'approved',
      approval_status: 'approved',
    }))).toBe('recibo')
  })

  it('humano Listo solo con CTA explícito + Revisión + aprobación del cliente', () => {
    expect(poolPublishState(idea({
      client_edit_mode: 'human',
      staff_client_approval: 'approved',
      approval_status: 'approved',
      staff_pool_ready: true,
    }))).toBe('listo')
    expect(poolPublishState(idea({
      client_edit_mode: 'human',
      entregas_review_status: 'approved',
      approval_status: 'approved',
      staff_pool_ready: true,
    }))).toBe('listo')
  })

  it('humano con CTA pero sin Revisión se queda en recibo', () => {
    expect(poolPublishState(idea({
      client_edit_mode: 'human',
      staff_client_approval: 'approved',
      staff_pool_ready: true,
      approval_status: 'submitted',
    }))).toBe('recibo')
  })

  it('Agendado: Metricool ya tiene el post (metricool_post_id o posted_at)', () => {
    expect(poolPublishState(idea({
      staff_client_approval: 'approved',
      metricool_post_id: 99,
    }))).toBe('agendado')
    expect(poolPublishState(idea({
      staff_client_approval: 'approved',
      posted_at: '2026-09-21T10:00:00Z',
    }))).toBe('agendado')
  })

  it('Agendado no usa solo publish_date planificada', () => {
    expect(poolPublishState(idea({
      staff_client_approval: 'approved',
      publish_date: '2026-09-22',
    }))).toBe('listo')
  })

  it('Publicado gana sobre Agendado', () => {
    expect(poolPublishState(idea({
      metricool_post_id: 1,
      published_at: '2026-09-20T12:00:00Z',
    }))).toBe('publicado')
    expect(poolPublishState(idea({
      metricool_post_id: 1,
      status: 'publicada',
    }))).toBe('publicado')
    expect(poolPublishState(idea({
      metricool_post_id: 1,
      manual_posted_status: 'posted',
    }))).toBe('publicado')
  })

  it('descartada no entra al pool', () => {
    expect(poolPublishState(idea({
      status: 'descartada',
      staff_client_approval: 'approved',
    }))).toBe('recibo')
  })
})

describe('calendario del panel: solo agendado + publicado', () => {
  it('Listo / recibo no van al calendario', () => {
    expect(isCalendarEligible('listo')).toBe(false)
    expect(isCalendarEligible('recibo')).toBe(false)
    expect(isCalendarEligible('agendado')).toBe(true)
    expect(isCalendarEligible('publicado')).toBe(true)
  })
})

describe('schedule gates', () => {
  it('Listo de Recibo (AI o humano con CTA) crea el post de Metricool', () => {
    expect(canCreateMetricoolSchedule('listo', 'ai')).toBe(true)
    expect(canCreateMetricoolSchedule('listo', 'human')).toBe(true)
    expect(canCreateMetricoolSchedule('agendado', 'ai')).toBe(false)
    expect(canCreateMetricoolSchedule('recibo', 'ai')).toBe(false)
    expect(canCreateMetricoolSchedule('recibo', 'human')).toBe(false)
    expect(canCreateMetricoolSchedule('publicado', 'ai')).toBe(false)
  })

  it('Agendado se puede reprogramar sin un segundo POST', () => {
    expect(canReschedulePoolIdea('agendado')).toBe(true)
    expect(canReschedulePoolIdea('listo')).toBe(false)
    expect(canReschedulePoolIdea('publicado')).toBe(false)
  })
})

describe('aviso de /aprobacion — silencioso solo en Recibo/AI al aprobar', () => {
  it('AI + approved: sin aviso', () => {
    expect(shouldNotifyClientVote('approved', 'ai')).toBe(false)
  })

  it('AI + rejected: sí avisa', () => {
    expect(shouldNotifyClientVote('rejected', 'ai')).toBe(true)
  })

  it('humano Entregas: avisa al aprobar y al rechazar', () => {
    expect(shouldNotifyClientVote('approved', 'human')).toBe(true)
    expect(shouldNotifyClientVote('rejected', 'human')).toBe(true)
    expect(shouldNotifyClientVote('approved', null)).toBe(true)
  })
})

describe('puente humano Recibo → pool', () => {
  const humanApproved = {
    client_edit_mode: 'human' as const,
    staff_client_approval: 'approved' as const,
    approval_status: 'approved' as const,
  }

  it('el CTA no es automático: aprobado humano sin staff_pool_ready no se envía', () => {
    expect(canSendHumanReciboToPool(idea(humanApproved))).toBe(true)
    expect(humanPoolGate(idea(humanApproved))).toBe('ok')
    expect(canSendHumanReciboToPool(idea({ ...humanApproved, staff_pool_ready: true }))).toBe(false)
    expect(humanPoolGate(idea({ ...humanApproved, staff_pool_ready: true }))).toBe('already_listo')
  })

  it('no salta Revisión: submitted / revision_needed bloquean el pool', () => {
    expect(humanPoolGate(idea({ ...humanApproved, approval_status: 'submitted' }))).toBe('falta_revision')
    expect(humanPoolGate(idea({ ...humanApproved, approval_status: 'revision_needed' }))).toBe('falta_revision')
    expect(canSendHumanReciboToPool(idea({ ...humanApproved, approval_status: 'submitted' }))).toBe(false)
  })

  it('cliente AI no usa el CTA (entra solo al aprobar en Recibo)', () => {
    expect(humanPoolGate(idea({ staff_client_approval: 'approved' }))).toBe('ai_auto')
    expect(canSendHumanReciboToPool(idea({ staff_client_approval: 'approved' }))).toBe(false)
  })

  it('sin aprobación del cliente no se envía', () => {
    expect(humanPoolGate(idea({
      client_edit_mode: 'human',
      approval_status: 'approved',
    }))).toBe('not_approved')
  })
})

describe('weekCadenceDates', () => {
  it('solo los posting_days de esa semana (lun=1 … dom=0)', () => {
    // 2026-09-21 lun … 2026-09-27 dom; posting_days mié(3) y vie(5)
    expect(weekCadenceDates([3, 5], WEEK)).toEqual(['2026-09-23', '2026-09-25'])
  })
})

describe('buildClientPoolPanel', () => {
  const ai: PoolClientInput = {
    id: 'ai',
    name: 'Arecibo Lab',
    posting_days: [3, 5],
    edit_mode: 'ai',
    metricool_blog_id: 'blog-1',
  }
  const human: PoolClientInput = {
    id: 'hum',
    name: 'Cliente humano',
    posting_days: [1],
    edit_mode: 'human',
    metricool_blog_id: 'blog-2',
  }

  function row(over: Partial<PoolIdeaInput> & Pick<PoolIdeaInput, 'id' | 'client_id'>): PoolIdeaInput {
    return {
      title: over.title ?? over.id,
      status: 'producida',
      publish_date: null,
      published_at: null,
      metricool_post_id: null,
      posted_at: null,
      staff_client_approval: null,
      ...over,
    }
  }

  it('esconde el pool vacío y deja el cliente si tiene cadencia esta semana', () => {
    const panel = buildClientPoolPanel({
      clients: [ai],
      ideas: [],
      week: WEEK,
    })
    expect(panel.clients).toHaveLength(1)
    expect(panel.clients[0].pool).toEqual([])
    expect(panel.clients[0].hidePool).toBe(true)
    expect(panel.clients[0].weekDates).toEqual(['2026-09-23', '2026-09-25'])
  })

  it('el pool Listo muestra AI aprobados y humano solo con CTA a Listo', () => {
    const panel = buildClientPoolPanel({
      clients: [ai, human],
      ideas: [
        row({ id: 'l1', client_id: 'ai', staff_client_approval: 'approved', title: 'Listo 1' }),
        row({
          id: 'a1',
          client_id: 'ai',
          staff_client_approval: 'approved',
          metricool_post_id: 7,
          publish_date: '2026-09-23',
          title: 'Ya agendado',
        }),
        row({
          id: 'h1',
          client_id: 'hum',
          entregas_review_status: 'approved',
          approval_status: 'approved',
          title: 'Humano aprobado',
        }),
        row({
          id: 'h2',
          client_id: 'hum',
          staff_client_approval: 'approved',
          approval_status: 'approved',
          staff_pool_ready: true,
          title: 'Humano Listo',
        }),
      ],
      week: WEEK,
    })
    const arecibo = panel.clients.find((c) => c.client.id === 'ai')
    const humano = panel.clients.find((c) => c.client.id === 'hum')
    expect(arecibo?.pool.map((v) => v.id)).toEqual(['l1'])
    expect(arecibo?.hidePool).toBe(false)
    expect(arecibo?.weekPosts.map((v) => v.id)).toEqual(['a1'])
    expect(humano?.pool.map((v) => v.id)).toEqual(['h2'])
    expect(humano?.hidePool).toBe(false)
  })

  it('el calendario del panel solo lleva agendado y publicado', () => {
    const panel = buildClientPoolPanel({
      clients: [ai],
      ideas: [
        row({ id: 'l1', client_id: 'ai', staff_client_approval: 'approved' }),
        row({
          id: 'a1',
          client_id: 'ai',
          metricool_post_id: 1,
          publish_date: '2026-09-23',
        }),
        row({
          id: 'p1',
          client_id: 'ai',
          status: 'publicada',
          publish_date: '2026-09-25',
        }),
      ],
      week: WEEK,
    })
    expect(panel.calendar.map((v) => v.id).sort()).toEqual(['a1', 'p1'])
    expect(panel.calendar.every((v) => v.state === 'agendado' || v.state === 'publicado')).toBe(true)
  })

  it('oculta clientes sin cadencia, sin posts de la semana y sin pool', () => {
    const idle: PoolClientInput = {
      id: 'idle',
      name: 'Sin nada',
      posting_days: [],
      edit_mode: 'ai',
    }
    const panel = buildClientPoolPanel({
      clients: [idle],
      ideas: [],
      week: WEEK,
    })
    expect(panel.clients).toEqual([])
  })
})
