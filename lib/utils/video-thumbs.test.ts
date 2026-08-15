import { describe, it, expect } from 'vitest'
import { pickThumbFrames } from './video-thumbs'

describe('pickThumbFrames', () => {
  it('vacío → vacío', () => {
    expect(pickThumbFrames([], 5)).toEqual([])
  })

  it('menos frames que count → devuelve todos, en orden', () => {
    const frames = ['a', 'b', 'c']
    expect(pickThumbFrames(frames, 5)).toEqual(['a', 'b', 'c'])
  })

  it('exactamente count → devuelve todos', () => {
    const frames = ['a', 'b', 'c', 'd', 'e']
    expect(pickThumbFrames(frames, 5)).toEqual(['a', 'b', 'c', 'd', 'e'])
  })

  it('8 frames → 5 equiespaciados, conservando primero y último', () => {
    const frames = ['0', '1', '2', '3', '4', '5', '6', '7']
    const out = pickThumbFrames(frames, 5)
    expect(out).toHaveLength(5)
    expect(out[0]).toBe('0')
    expect(out[out.length - 1]).toBe('7')
    // equiespaciados: índices 0, ~1.75, ~3.5, ~5.25, 7 → 0,2,4,5,7 (redondeo estable)
    expect(out).toEqual(['0', '2', '4', '5', '7'])
  })

  it('conserva el orden original (no reordena)', () => {
    const frames = Array.from({ length: 10 }, (_, i) => `f${i}`)
    const out = pickThumbFrames(frames, 5)
    const indices = out.map((f) => frames.indexOf(f))
    expect(indices).toEqual([...indices].sort((a, b) => a - b))
  })

  it('count=0 → vacío', () => {
    expect(pickThumbFrames(['a', 'b'], 0)).toEqual([])
  })

  it('default count=5', () => {
    const frames = Array.from({ length: 8 }, (_, i) => `${i}`)
    expect(pickThumbFrames(frames)).toHaveLength(5)
  })
})
