import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RolePreviewBanner } from './role-preview-banner'

vi.mock('@/lib/actions/role-preview', () => ({
  stopRolePreview: '/stop-role-preview',
}))

describe('RolePreviewBanner', () => {
  it('makes the simulated role and exit action explicit', () => {
    render(<RolePreviewBanner role="editor" />)

    expect(screen.getByText(/estás viendo la aplicación como Editor/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Volver a Owner' })).toBeInTheDocument()
  })
})
