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
    media: { kind: 'image', src: '/changelog/x.png', alt: 'Eliminar borrador' },
    body: '- Toca «Eliminar borrador».',
  },
  {
    version: '5.0',
    date: '2026-10-16',
    headline: 'Recibos muestra tus videos pendientes.',
    media: { kind: 'video', src: '/changelog/recibos.mp4', alt: 'Recibos en video' },
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
    expect(await screen.findByRole('img', { name: 'Eliminar borrador' })).toBeInTheDocument()
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

describe('WhatsNew con otros avisos', () => {
  it('espera a que se cierre otro diálogo abierto (p. ej. la foto de perfil) antes de abrirse', async () => {
    const other = document.createElement('div')
    other.setAttribute('role', 'dialog')
    other.setAttribute('data-state', 'open')
    document.body.appendChild(other)
    mockFetch.mockResolvedValue(ok([ENTRIES[0]]))
    render(<WhatsNew />)
    await waitFor(() => expect(mockFetch).toHaveBeenCalled())
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.queryByText('Ya puedes eliminar un borrador.')).toBeNull()

    other.remove()
    expect(await screen.findByText('Ya puedes eliminar un borrador.')).toBeInTheDocument()
  })

  it('si el servidor no pudo leer el changelog no marca nada como visto', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500, json: async () => ({ error: 'changelog_unavailable' }) })
    render(<WhatsNew />)
    await waitFor(() => expect(mockFetch).toHaveBeenCalled())
    await new Promise((r) => setTimeout(r, 0))
    expect(localStorage.getItem(WHATS_NEW_STORAGE_KEY)).toBeNull()
  })
})

describe('WhatsNew media', () => {
  it('la foto sale sin esperar al markdown, encima del texto', async () => {
    mockFetch.mockResolvedValue(ok([ENTRIES[0]]))
    render(<WhatsNew />)
    await screen.findByRole('dialog')
    const img = screen.getByRole('img', { name: 'Eliminar borrador' })
    expect(img).toHaveAttribute('src', '/changelog/x.png')
    expect(img.compareDocumentPosition(screen.getByText('Ya puedes eliminar un borrador.')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('un video se reproduce solo, en silencio y en bucle', async () => {
    mockFetch.mockResolvedValue(ok([ENTRIES[1]]))
    render(<WhatsNew />)
    await screen.findByRole('dialog')
    const video = screen.getByLabelText('Recibos en video') as HTMLVideoElement
    expect(video.tagName).toBe('VIDEO')
    expect(video).toHaveAttribute('src', '/changelog/recibos.mp4')
    expect(video.autoplay).toBe(true)
    expect(video.muted).toBe(true)
    expect(video.loop).toBe(true)
  })

  it('sin captura enseña el diseño interactivo', async () => {
    mockFetch.mockResolvedValue(
      ok([{ ...ENTRIES[0], media: { kind: 'preview', src: '/previews/v1.html', alt: 'Diseño de la novedad' } }]),
    )
    render(<WhatsNew />)
    await screen.findByRole('dialog')
    expect(screen.getByTitle('Diseño de la novedad')).toHaveAttribute('src', '/previews/v1.html')
  })
})

describe('WhatsNew bundle', () => {
  it('no importa react-markdown de forma estática (se monta en todas las rutas)', async () => {
    const { readFileSync } = await import('node:fs')
    const src = readFileSync('components/shared/whats-new.tsx', 'utf8')
    expect(src).not.toMatch(/from 'react-markdown'|from 'remark-gfm'/)
  })
})
