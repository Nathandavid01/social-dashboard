import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { MetricoolPublishCard, type PublishVideo } from './metricool-publish-card'

const NOW = Date.parse('2026-07-27T12:00:00Z')

function video(over: Partial<PublishVideo> = {}): PublishVideo {
  return {
    id: 'v1',
    title: 'Promo de verano',
    clientName: 'Surf School PR',
    publishDate: '2026-07-30',
    postingTime: '14:30',
    metricoolPostId: null,
    ...over,
  }
}

const onPublish = vi.fn(async () => {})
beforeEach(() => { cleanup(); onPublish.mockReset(); onPublish.mockResolvedValue(undefined) })

const setup = (v = video(), canPublish = true) =>
  render(<MetricoolPublishCard video={v} canPublish={canPublish} onPublish={onPublish} nowMs={NOW} />)

describe('MetricoolPublishCard', () => {
  it('dice a dónde va y con qué día y hora', () => {
    setup()
    expect(screen.getByText(/enviar a metricool/i)).toBeInTheDocument()
    expect(screen.getByText('Jue 30 jul 2026 · 14:30')).toBeInTheDocument()
  })

  it('muestra el video y su cliente', () => {
    setup()
    expect(screen.getByText('Promo de verano')).toBeInTheDocument()
    expect(screen.getByText('Surf School PR')).toBeInTheDocument()
  })

  it('el botón manda el video', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: /enviar a metricool/i }))
    expect(onPublish).toHaveBeenCalledWith('v1')
  })

  it('avisa cuando la fecha planificada quedó atrás y se corre', () => {
    setup(video({ publishDate: '2026-07-01' }))
    expect(screen.getByText('Mar 28 jul 2026 · 12:00')).toBeInTheDocument()
    expect(screen.getByText(/fecha pasada/i)).toBeInTheDocument()
  })

  it('sin fecha planificada también avisa', () => {
    setup(video({ publishDate: null }))
    expect(screen.getByText(/sin fecha planificada/i)).toBeInTheDocument()
  })

  it('ya enviado: badge y sin botón', () => {
    setup(video({ metricoolPostId: 4321 }))
    expect(screen.getByText(/en metricool/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /enviar a metricool/i })).not.toBeInTheDocument()
  })

  it('sin permiso no se ve el botón, pero sí la fecha', () => {
    setup(video(), false)
    expect(screen.queryByRole('button', { name: /enviar a metricool/i })).not.toBeInTheDocument()
    expect(screen.getByText('Jue 30 jul 2026 · 14:30')).toBeInTheDocument()
  })

  it('no se puede mandar dos veces con doble click', () => {
    setup()
    const btn = screen.getByRole('button', { name: /enviar a metricool/i })
    fireEvent.click(btn)
    fireEvent.click(btn)
    expect(onPublish).toHaveBeenCalledTimes(1)
  })
})
