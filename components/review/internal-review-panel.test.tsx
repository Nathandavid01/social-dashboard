import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { InternalReviewPanel, type ReviewVideo } from './internal-review-panel'

function video(over: Partial<ReviewVideo> = {}): ReviewVideo {
  return {
    id: 'v1',
    title: 'Rutina de piernas',
    clientName: 'Nora Fitness',
    editedUrl: 'https://cdn.example.com/v1.mp4',
    approval_status: 'submitted',
    submitted_by: 'editor-1',
    submittedByName: 'Ana',
    ...over,
  }
}

const onDecision = vi.fn()
beforeEach(() => onDecision.mockReset())

function renderPanel(over: Partial<ReviewVideo> = {}, role: 'supervisor' | 'editor' = 'supervisor') {
  return render(
    <InternalReviewPanel video={video(over)} role={role} userId="sup-1" onDecision={onDecision} />,
  )
}

describe('InternalReviewPanel — the reviewer watches and decides', () => {
  it('shows the video, its title and who sent it', () => {
    const { container } = renderPanel()
    expect(screen.getByText('Rutina de piernas')).toBeInTheDocument()
    expect(screen.getByText(/Ana/)).toBeInTheDocument()
    expect(container.querySelector('video')).toHaveAttribute('src', 'https://cdn.example.com/v1.mp4')
  })

  it('el revisor ve las dos decisiones; devolver espera al comentario', () => {
    renderPanel()
    expect(screen.getByRole('button', { name: /aprobar/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /pedir cambios/i })).toBeDisabled()
  })

  it('approving reports the decision', () => {
    renderPanel()
    screen.getAllByRole('checkbox').forEach(c=>fireEvent.click(c))
    fireEvent.click(screen.getByRole('button', { name: /aprobar/i }))
    expect(onDecision).toHaveBeenCalledWith('approve', '')
  })

  it('la caja de comentarios está a la vista, sin tener que abrirla', () => {
    renderPanel()
    expect(screen.getByPlaceholderText(/qué hay que cambiar/i)).toBeInTheDocument()
  })

  it('no se puede devolver sin decir qué cambiar', () => {
    renderPanel()
    expect(screen.getByRole('button', { name: /pedir cambios/i })).toBeDisabled()
    fireEvent.change(screen.getByPlaceholderText(/qué hay que cambiar/i), {
      target: { value: 'Corta los primeros 2s' },
    })
    expect(screen.getByRole('button', { name: /pedir cambios/i })).toBeEnabled()
  })

  it('devolver manda la nota escrita', () => {
    renderPanel()
    fireEvent.change(screen.getByPlaceholderText(/qué hay que cambiar/i), {
      target: { value: 'Corta los primeros 2s' },
    })
    fireEvent.click(screen.getByRole('button', { name: /pedir cambios/i }))
    expect(onDecision).toHaveBeenCalledWith('request_changes', 'Corta los primeros 2s')
  })

  it('solo espacios no cuenta como comentario', () => {
    renderPanel()
    fireEvent.change(screen.getByPlaceholderText(/qué hay que cambiar/i), { target: { value: '   ' } })
    expect(screen.getByRole('button', { name: /pedir cambios/i })).toBeDisabled()
  })

  it('aprobar no exige comentario', () => {
    renderPanel()
    screen.getAllByRole('checkbox').forEach(c=>fireEvent.click(c))
    fireEvent.click(screen.getByRole('button', { name: /aprobar/i }))
    expect(onDecision).toHaveBeenCalledWith('approve', '')
  })

  it('an editor sees the state but cannot decide', () => {
    renderPanel({}, 'editor')
    expect(screen.queryByRole('button', { name: /aprobar/i })).not.toBeInTheDocument()
    expect(screen.getByText(/En revisión/)).toBeInTheDocument()
  })

  it('nobody reviews their own video', () => {
    renderPanel({ submitted_by: 'sup-1' })
    expect(screen.queryByRole('button', { name: /aprobar/i })).not.toBeInTheDocument()
    expect(screen.getByText(/no puedes revisar tu propio video/i)).toBeInTheDocument()
  })

  it('an already-approved video shows no decisions', () => {
    renderPanel({ approval_status: 'approved' })
    expect(screen.queryByRole('button', { name: /aprobar/i })).not.toBeInTheDocument()
    expect(screen.getByText('Aprobado')).toBeInTheDocument()
  })

  it('a video sent back shows the changes asked for', () => {
    renderPanel({ approval_status: 'revision_needed', reviewNote: 'Corta los primeros 2s' })
    expect(screen.getByText('Cambios pedidos')).toBeInTheDocument()
    expect(screen.getByText(/Corta los primeros 2s/)).toBeInTheDocument()
  })
})

it('invalidates approval checks when playback fails and requires rechecking after recovery', () => {
  const {container}=renderPanel()
  screen.getAllByRole('checkbox').forEach(c=>fireEvent.click(c))
  expect(screen.getByRole('button',{name:'Aprobar'})).toBeEnabled()
  fireEvent.error(container.querySelector('video')!)
  expect(screen.getByRole('alert')).toHaveTextContent('No Se Pudo Reproducir El Video')
  expect(screen.getByRole('button',{name:'Aprobar'})).toBeDisabled()
  screen.getAllByRole('checkbox').forEach(c=>{expect(c).not.toBeChecked();expect(c).toBeDisabled()})
  fireEvent.loadedData(container.querySelector('video')!)
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.getByRole('button',{name:'Aprobar'})).toBeDisabled()
})
it('does not transfer verification checks to a different preview', () => {
  const {rerender}=renderPanel()
  screen.getAllByRole('checkbox').forEach(c=>fireEvent.click(c))
  rerender(<InternalReviewPanel video={video({editedUrl:'https://cdn.example.com/new.mp4'})} role="supervisor" userId="sup-1" onDecision={onDecision}/> )
  expect(screen.getByRole('button',{name:'Aprobar'})).toBeDisabled()
  screen.getAllByRole('checkbox').forEach(c=>expect(c).not.toBeChecked())
})
it('offers preview renewal after a media error', () => {
 const retry=vi.fn()
 const {container}=render(<InternalReviewPanel video={video()} role="supervisor" userId="sup-1" onDecision={onDecision} onRetryPreview={retry}/> )
 fireEvent.error(container.querySelector('video')!)
 fireEvent.click(screen.getByRole('button',{name:'Reintentar Reproducción'}))
 expect(retry).toHaveBeenCalledOnce()
 expect(screen.getByRole('button',{name:'Aprobar'})).toBeDisabled()
})
