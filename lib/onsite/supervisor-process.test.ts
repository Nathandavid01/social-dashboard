import { describe, it, expect } from 'vitest'
import { SUPERVISOR_PROCESS, supervisorNavLabel, supervisorProcessView } from './supervisor-process'

describe('SUPERVISOR_PROCESS', () => {
  it('On Site es el paso 1', () => {
    expect(SUPERVISOR_PROCESS[0]).toMatchObject({ n: 1, href: '/onsite', label: 'On Site' })
  })

  it('el step-by-step en /onsite marca el 1 como AQUÍ', () => {
    const view = supervisorProcessView('/onsite')
    expect(view[0]).toMatchObject({ n: 1, current: true, href: '/onsite' })
    expect(view.slice(1).every((s) => !s.current)).toBe(true)
  })
})

describe('supervisorNavLabel', () => {
  it('supervisor y owner ven 1 en On Site', () => {
    expect(supervisorNavLabel('/onsite', 'supervisor', 'On Site')).toBe('1 · On Site')
    expect(supervisorNavLabel('/onsite', 'owner', 'On Site')).toBe('1 · On Site')
  })

  it('quien graba no ve el número — no es su mapa del proceso', () => {
    expect(supervisorNavLabel('/onsite', 'video', 'On Site')).toBe('On Site')
    expect(supervisorNavLabel('/onsite', null, 'On Site')).toBe('On Site')
  })
})
