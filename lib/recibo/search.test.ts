import { describe, expect, it } from 'vitest'
import { filterReciboIdeas } from './search'

const playa = {
  id: 'i1',
  title: 'Reel playa',
  hook: 'El atardecer en Arecibo',
  generated_caption: 'El laboratorio ya abrió en Arecibo.',
  caption_draft: null,
  client: { name: 'Arecibo Lab' },
}

const encías = {
  id: 'i2',
  title: 'Encías',
  hook: null,
  generated_caption: '',
  caption_draft: 'Cuida tus encías cada noche.',
  client: { name: 'Farmacia Buena Vida' },
}

describe('filterReciboIdeas', () => {
  it('vacío o solo espacios devuelve todas las ideas', () => {
    expect(filterReciboIdeas([playa, encías], '')).toEqual([playa, encías])
    expect(filterReciboIdeas([playa, encías], '   ')).toEqual([playa, encías])
  })

  it('filtra por nombre de cliente sin importar mayúsculas', () => {
    expect(filterReciboIdeas([playa, encías], 'farmacia')).toEqual([encías])
  })

  it('filtra por título de la idea', () => {
    expect(filterReciboIdeas([playa, encías], 'playa')).toEqual([playa])
  })

  it('filtra por texto visible del caption o del hook', () => {
    expect(filterReciboIdeas([playa, encías], 'laboratorio')).toEqual([playa])
    expect(filterReciboIdeas([playa, encías], 'encías')).toEqual([encías])
    expect(filterReciboIdeas([playa, encías], 'atardecer')).toEqual([playa])
  })

  it('sin coincidencias devuelve lista vacía', () => {
    expect(filterReciboIdeas([playa, encías], 'metricool')).toEqual([])
  })
})
