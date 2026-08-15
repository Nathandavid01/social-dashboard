import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react'
import { UpdateNotice } from './update-notice'
import { APP_VERSION } from '@/lib/version'

const mockFetch = vi.fn()

beforeEach(() => {
  cleanup()
  mockFetch.mockReset()
  vi.stubGlobal('fetch', mockFetch)
})

const versionResponse = (version: string) => ({ ok: true, json: async () => ({ version }) })

describe('UpdateNotice', () => {
  it('cuando el servidor ya corre otra versión, el aviso sale en pantalla', async () => {
    mockFetch.mockResolvedValue(versionResponse('99.0'))
    render(<UpdateNotice />)
    await waitFor(() => {
      expect(screen.getByText(/hay una versión nueva/i)).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: /actualizar/i })).toBeInTheDocument()
  })

  it('con la misma versión no sale nada', async () => {
    mockFetch.mockResolvedValue(versionResponse(APP_VERSION))
    render(<UpdateNotice />)
    await waitFor(() => expect(mockFetch).toHaveBeenCalled())
    expect(screen.queryByText(/hay una versión nueva/i)).toBeNull()
  })

  it('si el chequeo falla (red caída) no sale nada ni revienta', async () => {
    mockFetch.mockRejectedValue(new Error('offline'))
    render(<UpdateNotice />)
    await waitFor(() => expect(mockFetch).toHaveBeenCalled())
    expect(screen.queryByText(/hay una versión nueva/i)).toBeNull()
  })

  it('el botón Actualizar recarga la página', async () => {
    mockFetch.mockResolvedValue(versionResponse('99.0'))
    const reload = vi.fn()
    vi.stubGlobal('location', { ...window.location, reload })
    render(<UpdateNotice />)
    await waitFor(() => screen.getByRole('button', { name: /actualizar/i }))
    fireEvent.click(screen.getByRole('button', { name: /actualizar/i }))
    expect(reload).toHaveBeenCalled()
  })
})
