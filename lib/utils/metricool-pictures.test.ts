import { describe, it, expect } from 'vitest'
import { mapMetricoolPictures } from './metricool-pictures'

describe('mapMetricoolPictures', () => {
  it('maps blog id to picture url', () => {
    expect(
      mapMetricoolPictures([
        { id: '123', name: 'Codepola', picture: 'https://cdn.metricool.com/pic.png' },
      ]),
    ).toEqual({ '123': 'https://cdn.metricool.com/pic.png' })
  })

  it('falls back to userPicture when picture is missing', () => {
    expect(
      mapMetricoolPictures([
        { id: '9', name: 'X', userPicture: 'https://cdn.metricool.com/user.png' } as never,
      ]),
    ).toEqual({ '9': 'https://cdn.metricool.com/user.png' })
  })

  it('skips deleted and demo brands', () => {
    expect(
      mapMetricoolPictures([
        { id: '1', name: 'A', picture: 'https://a.png', deleted: true } as never,
        { id: '2', name: 'B', picture: 'https://b.png', isDemo: true } as never,
        { id: '3', name: 'C', picture: 'https://c.png' },
      ]),
    ).toEqual({ '3': 'https://c.png' })
  })
})
