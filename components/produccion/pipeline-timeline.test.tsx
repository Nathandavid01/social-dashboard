/**
 * PipelineTimeline — the stage pills on the idea detail page.
 * Requirement: all pills fit on one screen (no horizontal scroll), and a DONE
 * stage that isn't the active one collapses to an icon (label hidden) to save room.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { PipelineTimeline, type TimelineStage } from './pipeline-timeline'

beforeEach(cleanup)

const STAGES: TimelineStage[] = [
  { id: 'a', label: 'Idea', icon: 'idea', done: true },        // active by default → label shown
  { id: 'b', label: 'Caption', icon: 'caption', done: true },  // done & not active → icon-only
  { id: 'c', label: 'Material', icon: 'material', done: false }, // pending → label shown
]

describe('PipelineTimeline', () => {
  it('does not scroll horizontally (no overflow-x-auto on the list)', () => {
    const { container } = render(<PipelineTimeline stages={STAGES} />)
    const ol = container.querySelector('ol')!
    expect(ol.className).not.toContain('overflow-x-auto')
  })

  it('collapses a done, non-active stage to an icon (hides its text label)', () => {
    render(<PipelineTimeline stages={STAGES} />)
    // "Caption" is done and not active → icon-only, no visible text label…
    expect(screen.queryByText('Caption')).toBeNull()
    // …but still reachable as a button (accessible name preserved)
    expect(screen.getByRole('button', { name: 'Caption' })).toBeInTheDocument()
  })

  it('shows the label for the active and the pending stages', () => {
    render(<PipelineTimeline stages={STAGES} />)
    expect(screen.getByText('Idea')).toBeInTheDocument()      // active
    expect(screen.getByText('Material')).toBeInTheDocument()  // pending
  })
})
