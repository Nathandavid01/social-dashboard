import { describe, it, expect } from 'vitest'
import { planWeek, bucketClient, weeklyPlanHeadline, weeklyPlanSubline } from './weekly-plan-core'
import { computeRunway } from './content-runway'
import type { WeeklyPlanClient } from './weekly-plan-core'

/** A client with `weeks` of content buffered at every stage. */
function client(id: string, weeks: number, cadence = 2): WeeklyPlanClient {
  const count = Math.round(weeks * cadence)
  return {
    clientId: id,
    clientName: id,
    weeklyCadence: cadence,
    runway: computeRunway({
      ideas: count,
      porEditar: count,
      porPublicar: count,
      weeklyCadence: cadence,
    }),
  }
}

/** A client nobody configured a cadence for. */
function noCadence(id: string): WeeklyPlanClient {
  return {
    clientId: id,
    clientName: id,
    weeklyCadence: 0,
    runway: computeRunway({ ideas: 0, porEditar: 0, porPublicar: 0, weeklyCadence: 0 }),
  }
}

describe('bucketClient', () => {
  it('is urgente when the content runs out in under a week', () => {
    const { bucket, reason } = bucketClient(client('a', 0.5))
    expect(bucket).toBe('urgente')
    expect(reason).toMatch(/sin contenido listo/i)
  })

  it('names the commitment date, which is what tells you what to do', () => {
    const c = { ...client('a', 0), nextPublishDate: '2026-07-16' }
    expect(bucketClient(c).reason).toMatch(/publica el 16 jul/i)
  })

  it('needs attention this week when under two weeks are left', () => {
    expect(bucketClient(client('a', 1.5)).bucket).toBe('esta_semana')
  })

  it('can wait with a healthy buffer', () => {
    const { bucket, reason } = bucketClient(client('a', 5))
    expect(bucket).toBe('puede_esperar')
    expect(reason).toMatch(/en banco/i)
  })

  // Guessing "they're fine" would quietly hide a client nobody is serving.
  it('sets aside a client with no cadence rather than guessing', () => {
    const { bucket, reason } = bucketClient(noCadence('a'))
    expect(bucket).toBe('sin_cadencia')
    expect(reason).toMatch(/sin cadencia/i)
  })

  it('treats a client with zero content as urgente, not as "no cadence"', () => {
    expect(bucketClient(client('a', 0)).bucket).toBe('urgente')
  })
})

describe('planWeek', () => {
  // The whole point: a Monday shows 8 clients, not 50.
  it('separates the short list of clients to touch from the ones that can wait', () => {
    const plan = planWeek([
      client('urge', 0.5),
      client('pronto', 1.5),
      client('ok1', 6),
      client('ok2', 8),
      noCadence('nadie'),
    ])
    expect(plan.urgentes.map((i) => i.clientId)).toEqual(['urge'])
    expect(plan.estaSemana.map((i) => i.clientId)).toEqual(['pronto'])
    expect(plan.puedenEsperar.map((i) => i.clientId)).toEqual(['ok1', 'ok2'])
    expect(plan.sinCadencia.map((i) => i.clientId)).toEqual(['nadie'])
    // Only the ones that need a human this week.
    expect(plan.tocanCount).toBe(2)
    expect(plan.total).toBe(5)
  })

  it('puts the client closest to running out first', () => {
    // cadence 10 → whole-video counts land on the exact week fractions we want.
    const plan = planWeek([client('b', 0.8, 10), client('a', 0.2, 10), client('c', 0.5, 10)])
    expect(plan.urgentes.map((i) => i.clientId)).toEqual(['a', 'c', 'b'])
  })

  // The real account: EVERY client sits at zero buffered content, so the runway
  // ties them all. Without this tiebreak the "short list" is alphabetical — i.e.
  // useless. Who publishes first is what decides who you shoot on Monday.
  it('ranks tied clients by who publishes soonest', () => {
    const plan = planWeek([
      { ...client('viernes', 0), nextPublishDate: '2026-07-17' },
      { ...client('manana', 0), nextPublishDate: '2026-07-15' },
      { ...client('sin_fecha', 0), nextPublishDate: null },
      { ...client('hoy', 0), nextPublishDate: '2026-07-14' },
    ])
    expect(plan.urgentes.map((i) => i.clientId)).toEqual([
      'hoy',
      'manana',
      'viernes',
      'sin_fecha', // no commitment → last
    ])
  })

  // A client without a cadence must never be counted as work for this week —
  // that would inflate the short list with clients we can't even plan for.
  it('does not count clients with no cadence as work for this week', () => {
    const plan = planWeek([noCadence('a'), noCadence('b'), client('ok', 6)])
    expect(plan.tocanCount).toBe(0)
  })

  it('handles an empty account', () => {
    const plan = planWeek([])
    expect(plan).toMatchObject({ tocanCount: 0, total: 0 })
  })
})

describe('copy', () => {
  it('headlines the short list against the total', () => {
    const plan = planWeek([client('a', 0.5), client('b', 1.5), client('c', 6)])
    expect(weeklyPlanHeadline(plan)).toBe('Esta semana tocan 2 clientes de 3')
  })

  it('says so plainly when nothing needs attention', () => {
    const plan = planWeek([client('a', 6), client('b', 8)])
    expect(weeklyPlanHeadline(plan)).toMatch(/ningún cliente necesita atención/i)
  })

  it('uses the singular for one client', () => {
    expect(weeklyPlanHeadline(planWeek([client('a', 0.5), client('b', 6)]))).toBe(
      'Esta semana toca 1 cliente de 2',
    )
  })

  it('breaks down the rest in the subline', () => {
    const sub = weeklyPlanSubline(planWeek([client('a', 0.5), client('b', 6), noCadence('c')]))
    expect(sub).toMatch(/1 se queda sin contenido ya/)
    expect(sub).toMatch(/pueden esperar/)
    expect(sub).toMatch(/sin cadencia/)
  })
})
