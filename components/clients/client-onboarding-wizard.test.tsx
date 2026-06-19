/**
 * Tests for the guided client onboarding wizard. Server actions are mocked.
 * The wizard must: gate "Crear y continuar" until name + ≥1 platform, create
 * the client and advance, and let optional steps be skipped.
 */
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'

const createClient = vi.fn(async (_values?: unknown) => ({ success: true as const, id: 'c1' }))
const updateClient = vi.fn(async () => ({ success: true as const }))
vi.mock('@/lib/actions/clients', () => ({
  createClient: (...a: unknown[]) => createClient(...(a as [])),
  updateClient: (...a: unknown[]) => updateClient(...(a as [])),
}))
const setClientPostingDays = vi.fn(async () => ({ ok: true as const }))
vi.mock('@/lib/actions/posting-days', () => ({
  setClientPostingDays: (...a: unknown[]) => setClientPostingDays(...(a as [])),
}))
vi.mock('@/lib/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

import { ClientOnboardingWizard } from './client-onboarding-wizard'

afterEach(() => cleanup())
beforeEach(() => {
  createClient.mockClear()
  setClientPostingDays.mockClear()
})

const members = [{ id: 'u1', full_name: 'Ana', email: 'ana@x.com' }]

describe('ClientOnboardingWizard', () => {
  it('disables create until there is a name and a platform', () => {
    render(<ClientOnboardingWizard teamMembers={members} />)
    const btn = screen.getByRole('button', { name: /crear y continuar/i })
    expect(btn).toBeDisabled()
    fireEvent.change(screen.getByPlaceholderText(/sofá & co/i), { target: { value: 'Acme' } })
    expect(btn).toBeDisabled() // still no platform
    fireEvent.click(screen.getByLabelText('Instagram'))
    expect(btn).toBeEnabled()
  })

  it('creates the client and advances to the Metricool step', async () => {
    render(<ClientOnboardingWizard teamMembers={members} />)
    fireEvent.change(screen.getByPlaceholderText(/sofá & co/i), { target: { value: 'Acme' } })
    fireEvent.click(screen.getByLabelText('Instagram'))
    fireEvent.click(screen.getByRole('button', { name: /crear y continuar/i }))
    await waitFor(() => expect(createClient).toHaveBeenCalledTimes(1))
    expect(createClient.mock.calls[0][0]).toMatchObject({ name: 'Acme', platforms: ['instagram'], status: 'active' })
    expect(await screen.findByText(/cuenta de metricool/i)).toBeInTheDocument()
  })

  it('lets an optional step be skipped', async () => {
    render(<ClientOnboardingWizard teamMembers={members} />)
    fireEvent.change(screen.getByPlaceholderText(/sofá & co/i), { target: { value: 'Acme' } })
    fireEvent.click(screen.getByLabelText('Instagram'))
    fireEvent.click(screen.getByRole('button', { name: /crear y continuar/i }))
    const skip = await screen.findByRole('button', { name: /saltar por ahora/i })
    fireEvent.click(skip) // metricool → cadencia
    expect(await screen.findByText(/qué días se publica/i)).toBeInTheDocument()
  })
})
