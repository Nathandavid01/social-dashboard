import { describe, expect, it } from 'vitest'
import { cameraControls, flightArrived } from './scene-camera'

describe('cameraControls', () => {
  const c = cameraControls(30)

  it('wheel / pinch zooms toward the cursor so you can get close to a client', () => {
    expect(c.enableZoom).toBe(true)
    expect(c.zoomToCursor).toBe(true)
  })

  it('you can move around once zoomed in (right-drag / two fingers)', () => {
    expect(c.enablePan).toBe(true)
    expect(c.screenSpacePanning).toBe(true)
  })

  it('zoom is bounded: close enough to read a medallion, never lost in the void', () => {
    expect(c.minDistance).toBeLessThanOrEqual(4)
    expect(c.maxDistance).toBeCloseTo(30 * 1.6)
  })
})

describe('flightArrived', () => {
  it('a camera flight ends once target and distance are within a hair of the goal', () => {
    expect(flightArrived(0.01, 0.02)).toBe(true)
    expect(flightArrived(0.5, 0.02)).toBe(false)
    expect(flightArrived(0.01, 0.4)).toBe(false)
  })
})
