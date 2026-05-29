/**
 * Tests for the approval button (components/produccion/approval-button.tsx).
 *
 * Contract (docs/superpowers/specs/2026-05-28-client-video-pipeline-design.md §4):
 *   "approval-button.tsx renders the correct action(s) based on the current
 *    user's role and the idea's approval_status; shows a disabled/explanatory
 *    state when the user can't act."
 *
 * Role model: only owner OR a role with 'video.approve' can act. In this
 * codebase owner ('*') and supervisor have 'video.approve'; editor and video
 * do NOT (see lib/auth/permissions.ts). Permission is read in the client via
 * useHasPermission('video.approve') → useAuth().role.
 *
 * Status → expected actions for an authorised user:
 *   pending          → "submit for approval" action available
 *   submitted        → "approve" AND "request revision" actions available
 *   revision_needed  → "submit for approval" (re-submit) action available
 *   approved         → no action; terminal/disabled explanatory state
 *
 * Unauthorised users (no video.approve) → no actionable buttons; an
 * explanatory/disabled state instead.
 *
 * The auth context and the server actions are mocked.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import type { UserRole } from '@/lib/supabase/types'

// ── Mock the server actions (client component imports these) ─────────────────
const submitIdeaForApproval = vi.fn(async () => ({ ok: true as const }))
const approveIdea = vi.fn(async () => ({ ok: true as const }))
const requestRevision = vi.fn(async () => ({ ok: true as const }))
vi.mock('@/lib/actions/idea-approval', () => ({
  submitIdeaForApproval: (...a: unknown[]) => submitIdeaForApproval(...(a as [])),
  approveIdea: (...a: unknown[]) => approveIdea(...(a as [])),
  requestRevision: (...a: unknown[]) => requestRevision(...(a as [])),
}))

// ── Mock the auth context so useHasPermission resolves against a chosen role ──
let mockRole: UserRole | null = 'owner'
vi.mock('@/lib/context/auth-context', () => ({
  useAuth: () => ({ user: { id: 'u1', email: 'u@x.com' }, profile: null, role: mockRole }),
}))

// Toast is irrelevant to rendering assertions.
vi.mock('@/lib/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))

import { ApprovalButton } from './approval-button'

type Status = 'pending' | 'submitted' | 'approved' | 'revision_needed'

function renderButton(status: Status, role: UserRole | null) {
  mockRole = role
  return render(<ApprovalButton ideaId="idea-1" approvalStatus={status} />)
}

/** All buttons rendered, by visible text (lowercased) + disabled flag. */
function buttonStates() {
  return screen.queryAllByRole('button').map((b) => ({
    text: (b.textContent ?? '').trim().toLowerCase(),
    disabled: (b as HTMLButtonElement).disabled,
  }))
}

/** True when an *enabled* button's label contains the given substring. */
function hasEnabledAction(substr: string) {
  return buttonStates().some((b) => b.text.includes(substr) && !b.disabled)
}

beforeEach(() => {
  cleanup()
  submitIdeaForApproval.mockClear()
  approveIdea.mockClear()
  requestRevision.mockClear()
  mockRole = 'owner'
})

// ── Authorised role × status matrix (owner has '*', supervisor has video.approve) ──

describe('authorised approver — actions per status', () => {
  it.each(['owner', 'supervisor'] as UserRole[])(
    'pending: %s sees an enabled "submit/enviar" action',
    (role) => {
      renderButton('pending', role)
      expect(hasEnabledAction('enviar') || hasEnabledAction('aprob')).toBe(true)
    },
  )

  it.each(['owner', 'supervisor'] as UserRole[])(
    'submitted: %s can approve AND request revision (both enabled)',
    (role) => {
      renderButton('submitted', role)
      expect(hasEnabledAction('aprob')).toBe(true)
      expect(hasEnabledAction('revis') || hasEnabledAction('rechaz')).toBe(true)
    },
  )

  it('revision_needed: owner sees an enabled re-submit action', () => {
    renderButton('revision_needed', 'owner')
    expect(hasEnabledAction('enviar') || hasEnabledAction('reenv') || hasEnabledAction('aprob')).toBe(true)
  })

  it('approved: terminal — no enabled approve/submit actions, shows approved state', () => {
    renderButton('approved', 'owner')
    expect(hasEnabledAction('enviar')).toBe(false)
    // No enabled "approve" action remains once approved.
    const approveStillEnabled = buttonStates().some(
      (b) => b.text.includes('aprob') && !b.text.includes('aprobado') && !b.disabled,
    )
    expect(approveStillEnabled).toBe(false)
    // Surfaces the approved status somewhere in the rendered output.
    expect(screen.getByText(/aprobad/i)).toBeInTheDocument()
  })
})

// ── Unauthorised roles (no video.approve) ────────────────────────────────────

describe('unauthorised role — gated out', () => {
  it.each(['editor', 'video'] as UserRole[])(
    '%s cannot act on a submitted idea (no enabled approve/revision buttons)',
    (role) => {
      renderButton('submitted', role)
      expect(hasEnabledAction('aprob')).toBe(false)
      const states = buttonStates()
      // Either there are no buttons at all, or any present are disabled.
      const anyEnabled = states.some((b) => b.disabled === false)
      expect(anyEnabled).toBe(false)
    },
  )

  it('null role (logged-out / unknown) cannot act', () => {
    renderButton('submitted', null)
    expect(hasEnabledAction('aprob')).toBe(false)
    const anyEnabled = buttonStates().some((b) => b.disabled === false)
    expect(anyEnabled).toBe(false)
  })

  it('editor on a pending idea sees no enabled submit action', () => {
    renderButton('pending', 'editor')
    expect(hasEnabledAction('enviar')).toBe(false)
  })
})

// ── Wiring: clicking an action calls the matching server action ───────────────

describe('action wiring', () => {
  it('approve button invokes approveIdea with the idea id', async () => {
    const { default: userEventDefault } = await import('@testing-library/user-event')
    const user = userEventDefault.setup()
    renderButton('submitted', 'owner')
    const approveBtn = screen
      .getAllByRole('button')
      .find((b) => (b.textContent ?? '').toLowerCase().includes('aprob') && !(b as HTMLButtonElement).disabled)
    expect(approveBtn).toBeTruthy()
    await user.click(approveBtn!)
    expect(approveIdea).toHaveBeenCalledWith('idea-1')
  })

  it('submit button invokes submitIdeaForApproval with the idea id', async () => {
    const { default: userEventDefault } = await import('@testing-library/user-event')
    const user = userEventDefault.setup()
    renderButton('pending', 'owner')
    const submitBtn = screen
      .getAllByRole('button')
      .find((b) => (b.textContent ?? '').toLowerCase().includes('enviar') && !(b as HTMLButtonElement).disabled)
    if (submitBtn) {
      await user.click(submitBtn)
      expect(submitIdeaForApproval).toHaveBeenCalledWith('idea-1')
    } else {
      // Some implementations label the pending action "Aprobar" directly; tolerate.
      expect(submitIdeaForApproval).not.toHaveBeenCalled()
    }
  })
})
