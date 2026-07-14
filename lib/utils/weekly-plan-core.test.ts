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

const TODAY = '2026-07-14'

describe('bucketClient', () => {
  it('is urgente when the content runs out in under two weeks', () => {
    expect(bucketClient(client('a', 0.5), TODAY).bucket).toBe('urgente')
  })

  it('names the commitment date, which is what tells you what to do', () => {
    const c = { ...client('a', 0), nextPublishDate: '2026-07-16' }
    expect(bucketClient(c, TODAY).reason).toMatch(/publica el 16 jul/i)
  })

  // "Publica el 1 jul" about a date two weeks gone reads as a future plan. It
  // isn't — it's a broken promise, and the copy has to say so.
  it('says a passed date was MISSED, not that it is upcoming', () => {
    const c = { ...client('a', 0), nextPublishDate: '2026-07-01' }
    expect(bucketClient(c, TODAY).reason).toMatch(/debió publicar el 1 jul/i)
  })

  it('needs attention this week with a thin buffer', () => {
    expect(bucketClient(client('a', 3), TODAY).bucket).toBe('esta_semana')
  })

  it('can wait at or above the one-month goal', () => {
    const { bucket, reason } = bucketClient(client('a', 5), TODAY)
    expect(bucket).toBe('puede_esperar')
    expect(reason).toMatch(/en banco/i)
  })

  // The MIN of the three stages hides WHICH one is empty. A client with 20 shot
  // videos waiting on an editor looked identical to one with nothing — and the
  // list would send you to go shoot them. That's worse than saying nothing.
  describe('names the stage that is actually blocking', () => {
    const staged = (ideas: number, rec: number, ed: number) => ({
      clientId: 'a',
      clientName: 'a',
      weeklyCadence: 2,
      runway: computeRunway({ ideas, porEditar: rec, porPublicar: ed, weeklyCadence: 2 }),
    })

    it('tells you to EDIT when everything is shot but nothing is edited', () => {
      const { reason } = bucketClient(staged(40, 40, 0), TODAY)
      expect(reason).toMatch(/hay que editar/i)
      expect(reason).toMatch(/nada editado/i)
      expect(reason).not.toMatch(/grabar/i)
    })

    it('tells you to SHOOT when there are ideas but nothing recorded', () => {
      const { reason } = bucketClient(staged(40, 0, 40), TODAY)
      expect(reason).toMatch(/hay que grabar/i)
    })

    it('tells you to PLAN when there are no ideas at all', () => {
      const { reason } = bucketClient(staged(0, 40, 40), TODAY)
      expect(reason).toMatch(/planificar/i)
    })
  })

  // Guessing "they're fine" would quietly hide a client nobody is serving.
  it('sets aside a client with no cadence rather than guessing', () => {
    const { bucket, reason } = bucketClient(noCadence('a'), TODAY)
    expect(bucket).toBe('sin_cadencia')
    expect(reason).toMatch(/sin cadencia/i)
  })

  it('treats a client with zero content as urgente, not as "no cadence"', () => {
    expect(bucketClient(client('a', 0), TODAY).bucket).toBe('urgente')
  })
})

describe('planWeek', () => {
  // The whole point: a Monday shows 8 clients, not 50.
  it('separates the short list of clients to touch from the ones that can wait', () => {
    const plan = planWeek(
      [
        client('urge', 0.5),
        client('pronto', 3),
        client('ok1', 6),
        client('ok2', 8),
        noCadence('nadie'),
      ],
      TODAY,
    )
    expect(plan.urgentes.map((i) => i.clientId)).toEqual(['urge'])
    expect(plan.estaSemana.map((i) => i.clientId)).toEqual(['pronto'])
    expect(plan.puedenEsperar.map((i) => i.clientId)).toEqual(['ok1', 'ok2'])
    expect(plan.sinCadencia.map((i) => i.clientId)).toEqual(['nadie'])
    // Only the ones that need a human this week.
    expect(plan.tocanCount).toBe(2)
    expect(plan.total).toBe(5)
  })

  // The bucket IS the runway status, so the short list and the board below it can
  // never grade the same client differently.
  it('grades a client exactly like the runway board does', () => {
    for (const [weeks, bucket] of [[0.5, 'urgente'], [3, 'esta_semana'], [5, 'puede_esperar']] as const) {
      const c = client('x', weeks)
      const graded = planWeek([c], TODAY)
      const status = c.runway.status
      const expected = { risk: 'urgente', warn: 'esta_semana', ok: 'puede_esperar' }[status as 'risk' | 'warn' | 'ok']
      expect(expected).toBe(bucket)
      expect(graded[({ urgente: 'urgentes', esta_semana: 'estaSemana', puede_esperar: 'puedenEsperar' } as const)[bucket]]).toHaveLength(1)
    }
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
    const plan = planWeek(
      [
        { ...client('viernes', 0), nextPublishDate: '2026-07-17' },
        { ...client('manana', 0), nextPublishDate: '2026-07-15' },
        { ...client('hoy', 0), nextPublishDate: '2026-07-14' },
      ],
      TODAY,
    )
    expect(plan.urgentes.map((i) => i.clientId)).toEqual(['hoy', 'manana', 'viernes'])
  })

  // THE case on the live account: 39 clients have a commitment they already
  // missed. An overdue date is the most urgent thing there is — it must lead, not
  // sort behind a client who is still on time.
  it('puts an OVERDUE commitment ahead of an on-time one', () => {
    const plan = planWeek(
      [
        { ...client('al_dia', 0), nextPublishDate: '2026-07-15' },
        { ...client('atrasado', 0), nextPublishDate: '2026-07-01' },
      ],
      TODAY,
    )
    expect(plan.urgentes.map((i) => i.clientId)).toEqual(['atrasado', 'al_dia'])
  })

  // "No date" means we found NO content for them at all — the worst case, not the
  // calmest. It must not sink to the bottom of the urgent list.
  it('leads with the client that has nothing scheduled at all', () => {
    const plan = planWeek(
      [
        { ...client('con_fecha', 0), nextPublishDate: '2026-07-15' },
        { ...client('sin_nada', 0), nextPublishDate: null },
      ],
      TODAY,
    )
    expect(plan.urgentes.map((i) => i.clientId)).toEqual(['sin_nada', 'con_fecha'])
  })

  // A client without a cadence must never be counted as work for this week —
  // that would inflate the short list with clients we can't even plan for.
  it('does not count clients with no cadence as work for this week', () => {
    const plan = planWeek([noCadence('a'), noCadence('b'), client('ok', 6)], TODAY)
    expect(plan.tocanCount).toBe(0)
  })

  it('handles an empty account', () => {
    const plan = planWeek([])
    expect(plan).toMatchObject({ tocanCount: 0, total: 0 })
  })
})

describe('copy', () => {
  it('headlines the short list against the total', () => {
    const plan = planWeek([client('a', 0.5), client('b', 3), client('c', 6)], TODAY)
    expect(weeklyPlanHeadline(plan)).toBe('Esta semana tocan 2 clientes de 3')
  })

  it('says so plainly when nothing needs attention', () => {
    const plan = planWeek([client('a', 6), client('b', 8)], TODAY)
    expect(weeklyPlanHeadline(plan)).toMatch(/ningún cliente necesita atención/i)
  })

  it('uses the singular for one client', () => {
    expect(weeklyPlanHeadline(planWeek([client('a', 0.5), client('b', 6)], TODAY))).toBe(
      'Esta semana toca 1 cliente de 2',
    )
  })

  it('breaks down the rest in the subline', () => {
    const sub = weeklyPlanSubline(planWeek([client('a', 0.5), client('b', 6), noCadence('c')], TODAY))
    expect(sub).toMatch(/1 se queda sin contenido ya/)
    expect(sub).toMatch(/pueden esperar/)
    expect(sub).toMatch(/sin cadencia/)
  })
})
