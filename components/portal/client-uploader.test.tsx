import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ClientUploader } from './client-uploader'

describe('ClientUploader', () => {
  const fetchMock = vi.fn()
  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  it('renders the client name, formats and themes', () => {
    render(<ClientUploader clientId="c1" clientName="La Placita Café" />)
    expect(screen.getByText('La Placita Café')).toBeInTheDocument()
    expect(screen.getByText('Reel')).toBeInTheDocument()
    expect(screen.getByText('Post')).toBeInTheDocument()
    expect(screen.getByText('Testimonio de cliente')).toBeInTheDocument()
  })

  it('blocks submit and shows a validation error when nothing is chosen', () => {
    render(<ClientUploader clientId="c1" clientName="La Placita Café" />)
    fireEvent.click(screen.getByRole('button', { name: /Enviar mi video/i }))
    expect(screen.getByText(/Escoge un formato/i)).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
