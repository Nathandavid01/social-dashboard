import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { TableSkeleton, CardGridSkeleton, ListSkeleton } from './skeletons'

afterEach(cleanup)

const countPulses = (c: HTMLElement) => c.querySelectorAll('.animate-pulse').length

describe('skeletons', () => {
  it('TableSkeleton renders the requested number of rows', () => {
    const { container } = render(<TableSkeleton rows={3} />)
    // 1 header + 3 rows * 4 cells = at least 4 placeholders per row
    expect(countPulses(container)).toBeGreaterThanOrEqual(3 * 3)
  })

  it('CardGridSkeleton renders the requested number of cards', () => {
    const { container } = render(<CardGridSkeleton count={4} />)
    // each card has multiple skeleton bars
    expect(countPulses(container)).toBeGreaterThanOrEqual(4 * 3)
  })

  it('ListSkeleton renders the requested number of rows', () => {
    const { container } = render(<ListSkeleton rows={5} />)
    expect(countPulses(container)).toBeGreaterThanOrEqual(5)
  })

  it('placeholders are hidden from the accessibility tree', () => {
    const { container } = render(<ListSkeleton rows={2} />)
    expect(container.querySelector('[aria-hidden]')).not.toBeNull()
  })
})
