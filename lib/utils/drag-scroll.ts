/**
 * Pure helpers for click-and-drag horizontal panning of a scroll container.
 * The component wires native mouse events to these; keeping the math here
 * lets us unit-test it without relying on jsdom layout/scroll (which is a no-op).
 */

/** Minimum pointer travel (px) before a mousedown becomes a pan-drag (vs a click). */
export const DRAG_PAN_THRESHOLD = 6

/** New scrollLeft while dragging: anchor scroll position minus how far the pointer moved. */
export function panScrollLeft(startScrollLeft: number, startX: number, currentX: number): number {
  return startScrollLeft - (currentX - startX)
}

/** True once the pointer has travelled far enough to count as a drag (so we swallow the click). */
export function isPanDrag(startX: number, currentX: number, threshold: number = DRAG_PAN_THRESHOLD): boolean {
  return Math.abs(currentX - startX) >= threshold
}
