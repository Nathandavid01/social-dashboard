import { describe, it, expect } from 'vitest'
import { SUPERVISOR_PROCESS, supervisorNavLabel, supervisorProcessView } from './supervisor-process'

describe('SUPERVISOR_PROCESS', () => {
  it('On Site es el paso 1 y Pipeline el 2', () => {
    expect(SUPERVISOR_PROCESS[0]).toMatchObject({ n: 1, href: '/onsite', label: 'On Site' })
    expect(SUPERVISOR_PROCESS[1]).toMatchObject({ n: 2, href: '/pipeline', label: 'Edición' })
    expect(SUPERVISOR_PROCESS[2]).toMatchObject({ n: 3, href: '/revision', label: 'Revisión' })
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

it('names supervisor step 2 Edición',()=>{expect(supervisorNavLabel('/pipeline','supervisor','Pipeline')).toBe('2 · Edición')})
