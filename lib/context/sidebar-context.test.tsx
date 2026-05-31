/**
 * SidebarProvider — collapsed state for the sidebar, persisted to localStorage
 * so it survives navigation/reloads.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { SidebarProvider, useSidebar } from './sidebar-context'

function Probe() {
  const { collapsed, toggle } = useSidebar()
  return <button onClick={toggle}>{collapsed ? 'collapsed' : 'expanded'}</button>
}

beforeEach(() => {
  cleanup()
  localStorage.clear()
})

describe('SidebarProvider', () => {
  it('defaults to expanded', () => {
    render(<SidebarProvider><Probe /></SidebarProvider>)
    expect(screen.getByText('expanded')).toBeInTheDocument()
  })

  it('toggles to collapsed and persists', () => {
    render(<SidebarProvider><Probe /></SidebarProvider>)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('collapsed')).toBeInTheDocument()
    expect(localStorage.getItem('nm-sidebar-collapsed')).toBe('1')
  })

  it('restores the persisted collapsed state on mount', () => {
    localStorage.setItem('nm-sidebar-collapsed', '1')
    render(<SidebarProvider><Probe /></SidebarProvider>)
    expect(screen.getByText('collapsed')).toBeInTheDocument()
  })
})
