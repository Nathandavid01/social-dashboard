import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReciboClientNotice } from './recibo-client-notice'

describe('Recibo client production notice', () => {
  it('shows the confirmed recording scheduling notice', () => {
    render(<ReciboClientNotice notice="Hay que agendar una nueva grabación: se acabó el material disponible. Solo queda pendiente el video de matrimonio v19." />)
    expect(screen.getByRole('note')).toHaveTextContent('Hay que agendar una nueva grabación: se acabó el material disponible.')
  })
  it('shows nothing without a designated notice', () => {
    const { container, rerender } = render(<ReciboClientNotice />)
    expect(container).toBeEmptyDOMElement()
    rerender(<ReciboClientNotice notice="  " />)
    expect(container).toBeEmptyDOMElement()
  })
})
