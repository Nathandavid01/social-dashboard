import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { EditingClaimControls } from './editing-claim-controls'
import type { EditingClaim } from '@/lib/pipeline/editing-claim'

const actionMocks = vi.hoisted(() => ({
  claimPipelineEdit: vi.fn(),
  releasePipelineEdit: vi.fn(),
  userId: 'ed-diego',
  canForce: true,
}))

vi.mock('@/lib/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('@/lib/actions/pipeline-claim', () => ({
  claimPipelineEdit: (...a: unknown[]) => actionMocks.claimPipelineEdit(...a),
  releasePipelineEdit: (...a: unknown[]) => actionMocks.releasePipelineEdit(...a),
}))
vi.mock('@/components/auth/role-gate', () => ({
  useHasPermission: (perm: string) => (perm === 'planning.assign' ? actionMocks.canForce : true),
  useEffectiveUserId: () => actionMocks.userId,
  RoleGate: ({ children }: { children: unknown }) => children,
}))

const NOW = new Date('2026-10-19T12:00:00.000Z')

function claim(over: Partial<EditingClaim> = {}): EditingClaim {
  return { byId: 'ed-maria', byName: 'María R.', at: '2026-10-12T12:00:00.000Z', ...over }
}

describe('EditingClaimControls · claim vencido', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
    actionMocks.userId = 'ed-diego'
    actionMocks.canForce = true
    actionMocks.releasePipelineEdit.mockReset()
    actionMocks.claimPipelineEdit.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('a los 6 días no dice vencido; a los 7+ sí, en ámbar', () => {
    const { rerender } = render(
      <EditingClaimControls ideaId="i-fresh" claim={claim({ at: '2026-10-13T12:00:00.000Z' })} />,
    )
    const fresh = screen.getByTestId('editing-claim-i-fresh')
    expect(fresh).toHaveTextContent(/en edición — maría/i)
    expect(fresh).not.toHaveTextContent(/vencido/i)

    rerender(<EditingClaimControls ideaId="i-stale" claim={claim({ at: '2026-10-12T12:00:00.000Z' })} />)
    const stale = screen.getByTestId('editing-claim-i-stale')
    expect(stale).toHaveTextContent(/en edición — maría/i)
    expect(stale).toHaveTextContent(/vencido/i)
    expect(stale).toHaveTextContent(/hace 7d/i)
    expect(stale.className).toMatch(/amber|rose/)
  })

  it('el dueño sigue soltando un claim vencido con un clic — no se suelta solo', async () => {
    actionMocks.userId = 'ed-maria'
    actionMocks.releasePipelineEdit.mockResolvedValue({ ok: true })
    const onOptimistic = vi.fn()
    render(
      <EditingClaimControls
        ideaId="i-mine"
        claim={claim({ byId: 'ed-maria', at: '2026-10-01T12:00:00.000Z' })}
        onOptimistic={onOptimistic}
      />,
    )
    expect(screen.getByTestId('editing-claim-i-mine')).toHaveTextContent(/vencido/i)
    fireEvent.click(screen.getByRole('button', { name: /^soltar$/i }))
    await waitFor(() => expect(actionMocks.releasePipelineEdit).toHaveBeenCalledWith('i-mine'))
    expect(onOptimistic).toHaveBeenCalledWith({ byId: null, byName: null, at: null })
  })

  it('planning.assign puede force-Soltar un claim vencido de otra persona', async () => {
    actionMocks.canForce = true
    actionMocks.releasePipelineEdit.mockResolvedValue({ ok: true })
    render(<EditingClaimControls ideaId="i-other" claim={claim()} />)
    fireEvent.click(screen.getByRole('button', { name: /^soltar$/i }))
    await waitFor(() => expect(actionMocks.releasePipelineEdit).toHaveBeenCalledWith('i-other'))
  })
})
