import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LiveReachCounter } from './live-reach-counter'

describe('LiveReachCounter', () => {
  it('renders nothing when there is no real reach data', () => {
    const { container } = render(<LiveReachCounter />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing for a null/zero reach', () => {
    const { container } = render(<LiveReachCounter realReach={0} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the real total and honest label when reach is provided', () => {
    render(<LiveReachCounter realReach={1234567} />)
    expect(screen.getByText(/Alcance · últimos 12 meses/i)).toBeInTheDocument()
    expect(screen.getByText(/personas alcanzadas/i)).toBeInTheDocument()
  })
})
