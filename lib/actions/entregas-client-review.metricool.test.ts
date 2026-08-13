import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('votarRevisionPublica — no programa Metricool', () => {
  it('el voto de /aprobacion no importa el publicador', () => {
    const src = readFileSync(resolve(import.meta.dirname, 'entregas-client-review.ts'), 'utf8')
    expect(src).not.toMatch(/runIdeaPost|maybeAutoPostIdea|createDraftPost/)
  })
})
