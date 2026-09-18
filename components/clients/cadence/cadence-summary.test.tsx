import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CadenceSummary } from './cadence-summary'

describe('CadenceSummary', () => {
  it('renders the live cadence, not a stale copy', () => {
    render(
      <CadenceSummary
        source={{
          posting_days: [1, 5],
          posting_time: '10:00',
          posting_timezone: 'America/Puerto_Rico',
        }}
      />,
    )
    expect(screen.getByTestId('cadence-live-summary')).toHaveTextContent('2/sem · Lun · Vie · 10:00 · Puerto Rico')
  })

  it('does not invent a schedule when none was set', () => {
    render(<CadenceSummary source={{}} />)
    expect(screen.getByTestId('cadence-live-summary')).toHaveTextContent('Sin cadencia')
  })
})
