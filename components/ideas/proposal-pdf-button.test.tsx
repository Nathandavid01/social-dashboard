import { expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
const mocks = vi.hoisted(() => ({ build: vi.fn(() => ({ save: vi.fn() })), onsite: vi.fn(async () => ({ shots: [{ id: 'fresh', title: 'Texto guardado', hook: null, referenceUrl: null }] })) }))
vi.mock('@/lib/actions/onsite', () => ({ getOnsiteShots: mocks.onsite }))
vi.mock('@/lib/actions/ideas-batch', () => ({ getWrittenIdeas: vi.fn() }))
vi.mock('@/lib/ideas/proposal-pdf', () => ({ buildProposalPdf: mocks.build }))
vi.mock('@/lib/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
import { ProposalPdfButton } from './proposal-pdf-button'
it('exporta los cambios guardados en Onsite, aunque la pantalla conserve datos anteriores', async () => {
  render(<ProposalPdfButton sessionId="s1" clientName="Miti Miti" date="2026-09-10" ideas={[{ id: 'old', title: 'Anterior', hook: null, referenceUrl: null }]} />)
  await userEvent.click(screen.getByRole('button'))
  expect(mocks.onsite).toHaveBeenCalledWith('s1')
  expect(mocks.build).toHaveBeenCalledWith('Miti Miti', '2026-09-10', [{ id: 'fresh', title: 'Texto guardado', hook: null, referenceUrl: null }])
})
it('el PDF del enlace conserva la versión enviada al cliente', async () => {
  mocks.build.mockClear(); mocks.onsite.mockClear()
  const snapshot = [{ id: 'snapshot', title: 'Versión enviada', hook: null, referenceUrl: null }]
  render(<ProposalPdfButton clientName="Miti Miti" date="2026-09-10" ideas={snapshot} />)
  await userEvent.click(screen.getByRole('button'))
  expect(mocks.onsite).not.toHaveBeenCalled()
  expect(mocks.build).toHaveBeenCalledWith('Miti Miti', '2026-09-10', snapshot)
})
