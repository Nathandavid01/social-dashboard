import { describe, it, expect } from 'vitest'
import { panScrollLeft, isPanDrag, DRAG_PAN_THRESHOLD } from './drag-scroll'

describe('drag-scroll helpers', () => {
  it('pans left when the pointer moves right (content follows the hand)', () => {
    // anchor scrollLeft 100, pointer drags from x=200 → x=260 (right by 60)
    expect(panScrollLeft(100, 200, 260)).toBe(40)
  })

  it('pans right when the pointer moves left', () => {
    expect(panScrollLeft(100, 200, 140)).toBe(160)
  })

  it('does not move when the pointer is still', () => {
    expect(panScrollLeft(50, 200, 200)).toBe(50)
  })

  it('is not a drag until the pointer passes the threshold', () => {
    expect(isPanDrag(200, 200 + DRAG_PAN_THRESHOLD - 1)).toBe(false)
    expect(isPanDrag(200, 200 + DRAG_PAN_THRESHOLD)).toBe(true)
    expect(isPanDrag(200, 200 - DRAG_PAN_THRESHOLD)).toBe(true) // either direction
  })
})
