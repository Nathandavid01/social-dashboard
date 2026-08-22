import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SupervisorProcessSteps } from './supervisor-process-steps'

describe('SupervisorProcessSteps', () => {
  it('en On Site el 1 está marcado y es el primero', () => {
    render(<SupervisorProcessSteps pathname="/onsite" />)
    const current = screen.getByRole('link', { name: /On Site/ })
    expect(current).toHaveAttribute('aria-current', 'step')
    expect(current).toHaveTextContent(/^1/)
    const all = screen.getAllByRole('link')
    expect(all[0]).toHaveAttribute('href', '/onsite')
  })
})
