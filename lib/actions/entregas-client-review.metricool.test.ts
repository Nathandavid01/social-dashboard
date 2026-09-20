import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const src = readFileSync(resolve(import.meta.dirname, 'entregas-client-review.ts'), 'utf8')

describe('votarRevisionPublica — no programa Metricool', () => {
  it('el voto de /aprobacion no importa el publicador', () => {
    expect(src).not.toMatch(/runIdeaPost|maybeAutoPostIdea|createDraftPost/)
  })
})

describe('votarRevisionPublica — avisa al staff', () => {
  it('sigue usando notifyStaffOfClientReview, filtrado por shouldNotifyClientVote', () => {
    expect(src).toMatch(/notifyStaffOfClientReview/)
    expect(src).toMatch(/shouldNotifyClientVote/)
  })
})
