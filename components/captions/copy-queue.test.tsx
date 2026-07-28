import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { CopyQueue, type CopyVideo } from './copy-queue'

function video(over: Partial<CopyVideo> = {}): CopyVideo {
  return {
    id: 'v1',
    title: 'Rutina de piernas',
    clientName: 'Nora Fitness',
    generated_caption: null,
    platforms: ['instagram'],
    ...over,
  }
}

// Stands in for <IdeaCaptionEditor>, which fires onSaved after saving.
const renderEditor = vi.fn((v: CopyVideo, onSaved: (c: string) => void) => (
  <div data-testid="editor">
    editor:{v.id}
    <button onClick={() => onSaved('Copy escrito')}>Marcar copy escrito</button>
  </div>
))
beforeEach(() => { cleanup(); renderEditor.mockClear() })

function setup(videos: CopyVideo[]) {
  render(<CopyQueue videos={videos} renderEditor={renderEditor} />)
}

const three = [
  video({ id: 'v1', title: 'Uno' }),
  video({ id: 'v2', title: 'Dos' }),
  video({ id: 'v3', title: 'Tres' }),
]

describe('CopyQueue — un video a la vez para escribir el copy', () => {
  it('abre en el primero que no tiene copy, con contador', () => {
    setup(three)
    expect(screen.getByText('Uno')).toBeInTheDocument()
    expect(screen.getByText(/0 de 3 con copy/i)).toBeInTheDocument()
  })

  it('monta el editor solo del video en pantalla', () => {
    setup(three)
    expect(screen.getAllByTestId('editor')).toHaveLength(1)
    expect(screen.getByText('editor:v1')).toBeInTheDocument()
  })

  it('salta los que ya tienen copy escrito', () => {
    setup([
      video({ id: 'v1', title: 'Uno', generated_caption: 'Ya tiene copy' }),
      video({ id: 'v2', title: 'Dos' }),
    ])
    expect(screen.getByText('Dos')).toBeInTheDocument()
    expect(screen.getByText(/1 de 2 con copy/i)).toBeInTheDocument()
  })

  it('un copy en blanco no cuenta como escrito', () => {
    setup([video({ id: 'v1', title: 'Uno', generated_caption: '   ' })])
    expect(screen.getByText('Uno')).toBeInTheDocument()
    expect(screen.getByText(/0 de 1 con copy/i)).toBeInTheDocument()
  })

  it('al guardar el copy avanza al siguiente y sube el contador', () => {
    setup(three)
    fireEvent.click(screen.getByRole('button', { name: /marcar copy escrito/i }))
    expect(screen.getByText('Dos')).toBeInTheDocument()
    expect(screen.getByText(/1 de 3 con copy/i)).toBeInTheDocument()
  })

  it('avisa cuando ya no queda copy por escribir', () => {
    setup([video({ id: 'v1', generated_caption: 'listo' })])
    expect(screen.getByText(/no queda copy por escribir/i)).toBeInTheDocument()
    expect(screen.queryByTestId('editor')).not.toBeInTheDocument()
  })

  it('llega al estado final tras el último', () => {
    setup([video({ id: 'v1', title: 'Único' })])
    fireEvent.click(screen.getByRole('button', { name: /marcar copy escrito/i }))
    expect(screen.getByText(/no queda copy por escribir/i)).toBeInTheDocument()
  })

  it('deja moverse entre videos sin escribir nada', () => {
    setup(three)
    fireEvent.click(screen.getByRole('button', { name: /siguiente video/i }))
    expect(screen.getByText('Dos')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /video anterior/i }))
    expect(screen.getByText('Uno')).toBeInTheDocument()
  })

  it('muestra el cliente para no escribir con la marca equivocada', () => {
    setup([video({ clientName: 'Gym Titan' })])
    expect(screen.getByText('Gym Titan')).toBeInTheDocument()
  })
})
