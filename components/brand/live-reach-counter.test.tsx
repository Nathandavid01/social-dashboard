import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LiveReachCounter } from './live-reach-counter'

describe('LiveReachCounter', () => {
  it('muestra la etiqueta histórica y el texto de personas alcanzadas', () => {
    render(<LiveReachCounter />)
    expect(screen.getByText(/En vivo · histórico/i)).toBeInTheDocument()
    expect(screen.getByText(/personas alcanzadas/i)).toBeInTheDocument()
  })
})
