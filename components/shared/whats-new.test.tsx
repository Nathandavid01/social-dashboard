import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react'
import { WhatsNew, WHATS_NEW_STORAGE_KEY } from './whats-new'
import { APP_VERSION } from '@/lib/version'

const mockFetch = vi.fn()

const ENTRIES = [
  {
    version: APP_VERSION,
    date: '2026-10-18',
    headline: 'Ya puedes eliminar un borrador.',
    body: '- Toca «Eliminar borrador».\n\n![Eliminar borrador](/changelog/x.png)',
  },
  {
    version: '5.0',
    date: '2026-10-16',
    headline: 'Recibos muestra tus videos pendientes.',
    body: '- Selecciona un cliente.',
  },
]

const ok = (entries: unknown[]) => ({ ok: true, json: async () => ({ entries }) })

beforeEach(() => {
  cleanup()
  localStorage.clear()
  mockFetch.mockReset()
  vi.stubGlobal('fetch', mockFetch)
})

describe('WhatsNew', () => {
  it('si ya vio esta versión no pregunta al servidor ni muestra nada', async () => {
    localStorage.setItem(WHATS_NEW_STORAGE_KEY, APP_VERSION)
    render(<WhatsNew />)
    await new Promise((r) => setTimeout(r, 0))
    expect(mockFetch).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('pide lo nuevo desde la última versión vista', async () => {
    localStorage.setItem(WHATS_NEW_STORAGE_KEY, '5.0')
    mockFetch.mockResolvedValue(ok([ENTRIES[0]]))
    render(<WhatsNew />)
    await waitFor(() => expect(mockFetch).toHaveBeenCalled())
    expect(mockFetch.mock.calls[0][0]).toBe('/api/changelog?since=5.0')
  })

  it('recorre las novedades una por una y al terminar no vuelve a salir', async () => {
    mockFetch.mockResolvedValue(ok(ENTRIES))
    render(<WhatsNew />)

    await screen.findByRole('dialog')
    expect(screen.getByText('Ya puedes eliminar un borrador.')).toBeInTheDocument()
    expect(screen.getByText('1 de 2')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Eliminar borrador' })).toBeInTheDocument()
    expect(localStorage.getItem(WHATS_NEW_STORAGE_KEY)).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /siguiente/i }))
    expect(screen.getByText('Recibos muestra tus videos pendientes.')).toBeInTheDocument()
    expect(screen.getByText('2 de 2')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /anterior/i }))
    expect(screen.getByText('1 de 2')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /siguiente/i }))
    fireEvent.click(screen.getByRole('button', { name: /entendido/i }))

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(localStorage.getItem(WHATS_NEW_STORAGE_KEY)).toBe(APP_VERSION)
  })

  it('cerrar con la X también cuenta como visto', async () => {
    mockFetch.mockResolvedValue(ok([ENTRIES[0]]))
    render(<WhatsNew />)
    await screen.findByRole('dialog')
    fireEvent.click(screen.getByRole('button', { name: /cerrar/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(localStorage.getItem(WHATS_NEW_STORAGE_KEY)).toBe(APP_VERSION)
  })

  it('enlaza al historial completo', async () => {
    mockFetch.mockResolvedValue(ok([ENTRIES[0]]))
    render(<WhatsNew />)
    await screen.findByRole('dialog')
    expect(screen.getByRole('link', { name: /ver todo el historial/i })).toHaveAttribute('href', '/changelog')
  })

  it('sin novedades que mostrar marca la versión como vista y no abre nada', async () => {
    localStorage.setItem(WHATS_NEW_STORAGE_KEY, '5.0')
    mockFetch.mockResolvedValue(ok([]))
    render(<WhatsNew />)
    await waitFor(() => expect(localStorage.getItem(WHATS_NEW_STORAGE_KEY)).toBe(APP_VERSION))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('si falla la red no muestra nada ni marca como visto (se reintenta otro día)', async () => {
    mockFetch.mockRejectedValue(new Error('offline'))
    render(<WhatsNew />)
    await waitFor(() => expect(mockFetch).toHaveBeenCalled())
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(localStorage.getItem(WHATS_NEW_STORAGE_KEY)).toBeNull()
  })
})
