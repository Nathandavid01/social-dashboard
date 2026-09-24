import { describe, expect, it } from 'vitest'
import { matchMetricoolBlogId } from './metricool-profile'

const profiles = [
  { id: 6278882, name: 'ARECIBO LAB' },
  { id: 7054368, name: 'yabuuchisushi' },
  { id: 5671438, name: 'Nana’s Playhouse' },
  { id: 5775668, name: 'El Truco de Güin' },
]

describe('matchMetricoolBlogId', () => {
  it('empareja el nombre del cliente con la marca publicada en Metricool', () => {
    expect(matchMetricoolBlogId('Arecibo Lab', profiles)).toBe('6278882')
    expect(matchMetricoolBlogId('YabushiSushi', profiles)).toBe('7054368')
    expect(matchMetricoolBlogId('Arecibo Lab', [{ id: 6278882, label: 'ARECIBO LAB' }])).toBe('6278882')
    expect(matchMetricoolBlogId("Nana's Playhouse", profiles)).toBe('5671438')
  })

  it('no elige otra marca ni un empate', () => {
    expect(matchMetricoolBlogId('Blue Chiropractic', profiles)).toBeNull()
    expect(matchMetricoolBlogId('', profiles)).toBeNull()
    expect(
      matchMetricoolBlogId('Arecibo Lab', [
        { id: '1', name: 'ARECIBO LAB' },
        { id: '2', name: 'Arecibo Lab' },
      ]),
    ).toBeNull()
  })
})
