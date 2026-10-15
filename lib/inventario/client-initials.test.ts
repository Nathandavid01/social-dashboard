import { describe, expect, it } from 'vitest'
import { clientInitials } from './client-initials'

describe('clientInitials', () => {
  it('takes the first letter of the first two meaningful words', () => {
    expect(clientInitials('La Guira')).toBe('LG')
    expect(clientInitials('Café El Bosque')).toBe('CB')
    expect(clientInitials('Dr.Soler UltraFit Wellness Clinics ')).toBe('DS')
  })

  it('skips connectors and punctuation', () => {
    expect(clientInitials("Pa' ya Pal Barrio")).toBe('PY')
    expect(clientInitials('643 Sport Bar & Pizzería')).toBe('6S')
    expect(clientInitials('Lucas y Burgers')).toBe('LB')
  })

  it('one word → two letters; empty → ?', () => {
    expect(clientInitials('Quantika')).toBe('QU')
    expect(clientInitials('   ')).toBe('?')
  })
})
